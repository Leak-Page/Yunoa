import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface EmailRequest {
  to: string;
  type: 'verification' | 'password-reset';
  code?: string;
  resetLink?: string;
}

interface AuthWebhookPayload {
  user: {
    email: string;
    id: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST requests for the main functionality
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    const payload = await req.text();
    
    console.log('📨 Request reçue:', {
      method: req.method,
      bodyLength: payload.length
    });

    const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
    console.log('🔑 Hook secret configuré:', !!hookSecret);
    
    // Essayer de traiter comme webhook d'abord
    if (hookSecret && payload) {
      try {
        const webhookData = JSON.parse(payload);
        console.log('📋 Données webhook parsées:', {
          hasUser: !!webhookData.user,
          userEmail: webhookData.user?.email,
          hasEmailData: !!webhookData.email_data,
          actionType: webhookData.email_data?.email_action_type
        });

        // Si c'est un webhook valide, le traiter
        if (webhookData.user && webhookData.email_data) {
          return await handleAuthWebhook(webhookData.user, webhookData.email_data);
        }
      } catch (parseError) {
        console.log('❌ Erreur parsing webhook, essai comme requête manuelle:', parseError.message);
      }
    }

    // Handle manual API requests
    const emailRequest: EmailRequest = JSON.parse(payload);
    
    // Validate required fields
    if (!emailRequest.to || !emailRequest.type) {
      throw new Error('Missing required fields: to and type');
    }

    if (!isValidEmail(emailRequest.to)) {
      throw new Error('Invalid email address');
    }

    let subject: string;
    let html: string;

    if (emailRequest.type === 'verification') {
      // Générer automatiquement un code sécurisé côté serveur
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      subject = 'Votre code de vérification - Yunoa.xyz';
      html = getVerificationEmailTemplate(verificationCode);
      
      // Stocker le code dans la base de données
      await saveVerificationCode(emailRequest.to, verificationCode);
    } else if (emailRequest.type === 'password-reset') {
      if (!emailRequest.resetLink) {
        throw new Error('Lien de réinitialisation requis');
      }
      subject = 'Réinitialisation de votre mot de passe - Yunoa.xyz';
      html = getPasswordResetTemplate(emailRequest.resetLink);
    } else {
      throw new Error('Type d\'email non supporté');
    }

    // Send email
    const messageId = await sendEmail(emailRequest.to, subject, html);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email envoyé avec succès',
        messageId: messageId
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erreur lors de l\'envoi de l\'email',
        success: false
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function handleAuthWebhook(user: any, emailData: any): Promise<Response> {
  try {
    console.log('🔍 Traitement webhook Auth:', {
      hasUser: !!user,
      hasEmailData: !!emailData,
      actionType: emailData?.email_action_type
    });

    if (!user?.email) {
      throw new Error('Email utilisateur manquant dans le webhook');
    }

    let subject: string;
    let html: string;

    if (emailData?.email_action_type === 'recovery') {
      const resetLink = `${emailData.site_url}/auth/callback?token_hash=${emailData.token_hash}&type=recovery&redirect_to=${encodeURIComponent(emailData.redirect_to)}`;
      subject = 'Réinitialisation de votre mot de passe - Yunoa.xyz';
      html = getPasswordResetTemplate(resetLink);
      
      console.log('📧 Email de récupération préparé');
    } else if (emailData?.email_action_type === 'signup' || emailData?.email_action_type === 'magiclink') {
      // Pour les emails de confirmation Supabase, on informe juste l'utilisateur
      subject = 'Bienvenue sur Yunoa.xyz !';
      html = getWelcomeTemplate(user.email);
      
      console.log('📧 Email de bienvenue préparé');
    } else {
      console.warn('Type d\'email non supporté:', emailData?.email_action_type);
      // Retourner un succès même si on ne gère pas ce type
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Type ${emailData?.email_action_type} non géré mais webhook traité`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const messageId = await sendEmail(user.email, subject, html);

    console.log('✅ Webhook traité avec succès:', {
      email: user.email,
      messageId: messageId
    });

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: messageId 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error('❌ Erreur webhook:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const smtpConfig = {
    hostname: Deno.env.get('SMTP_HOST') || 'mail.yunoa.xyz',
    port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
    username: Deno.env.get('SMTP_USER'),
    password: Deno.env.get('SMTP_PASS'),
    secure: true, // Use TLS for port 465
  };

  // Validate SMTP configuration
  if (!smtpConfig.username || !smtpConfig.password) {
    throw new Error('Configuration SMTP manquante - vérifiez SMTP_USER et SMTP_PASS');
  }

  const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@yunoa.xyz>`;

  try {
    let conn: Deno.TlsConn;
    
    // Connect based on port and security
    if (smtpConfig.port === 465) {
      // Direct TLS connection for port 465 (SMTPS)
      conn = await Deno.connectTls({
        hostname: smtpConfig.hostname,
        port: smtpConfig.port,
      });
    } else {
      // For other ports, you might need STARTTLS
      throw new Error('Port non supporté. Utilisez le port 465 pour SMTPS');
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper function to send command and read response
    async function sendCommand(cmd: string): Promise<string> {
      console.log('SMTP CMD:', cmd.replace(/AUTH LOGIN|[A-Za-z0-9+/=]{20,}/g, '[AUTH DATA]'));
      await conn.write(encoder.encode(cmd + '\r\n'));
      
      const response = await readResponse(conn, decoder);
      console.log('SMTP RESP:', response.replace(/[A-Za-z0-9+/=]{20,}/g, '[AUTH DATA]'));
      
      if (response.startsWith('4') || response.startsWith('5')) {
        throw new Error(`SMTP Error: ${response}`);
      }
      
      return response;
    }

    // Read initial server greeting
    const greeting = await readResponse(conn, decoder);
    console.log('SMTP Greeting:', greeting);

    if (!greeting.startsWith('2')) {
      throw new Error(`SMTP connection failed: ${greeting}`);
    }

    // SMTP Protocol
    await sendCommand(`EHLO ${smtpConfig.hostname}`);
    
    // Authentication
    await sendCommand('AUTH LOGIN');
    await sendCommand(btoa(smtpConfig.username));
    await sendCommand(btoa(smtpConfig.password));

    // Send email
    await sendCommand(`MAIL FROM:<${smtpConfig.username}>`);
    await sendCommand(`RCPT TO:<${to}>`);
    await sendCommand('DATA');

    // Email content
    const emailContent = [
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      `From: "Yunoa" <${smtpConfig.username}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(subject)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      toQuotedPrintable(html),
      '.'
    ].join('\r\n');

    await conn.write(encoder.encode(emailContent + '\r\n'));
    
    const dataResponse = await readResponse(conn, decoder);
    if (!dataResponse.startsWith('2')) {
      throw new Error(`Failed to send email: ${dataResponse}`);
    }

    await sendCommand('QUIT');
    conn.close();

    console.log('✅ Email envoyé avec succès:', {
      to: to,
      subject: subject,
      messageId: messageId,
      timestamp: new Date().toISOString()
    });

    return messageId;
    
  } catch (error: any) {
    console.error('❌ Erreur SMTP:', error);
    throw new Error(`Erreur d'envoi d'email: ${error.message}`);
  }
}

async function readResponse(conn: Deno.TlsConn, decoder: TextDecoder): Promise<string> {
  const buffer = new Uint8Array(4096);
  let response = '';
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const n = await conn.read(buffer);
      if (n === null) break;
      
      const chunk = decoder.decode(buffer.subarray(0, n));
      response += chunk;
      
      // Check if we have a complete response (ends with CRLF)
      if (response.includes('\r\n')) {
        break;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    } catch (error) {
      console.error('Error reading response:', error);
      break;
    }
  }
  
  return response.trim();
}

function toQuotedPrintable(str: string): string {
  return str
    .replace(/[^\x20-\x7E]/g, (match) => {
      const hex = match.charCodeAt(0).toString(16).toUpperCase();
      return `=${hex.padStart(2, '0')}`;
    })
    .replace(/=\r\n/g, '\r\n')
    .replace(/(.{75})/g, '$1=\r\n')
    .replace(/=\r\n$/, '');
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getVerificationEmailTemplate(code: string): string {
  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Code de vérification - Yunoa.xyz</title>
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style type="text/css">
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        min-height: 100vh;
        padding: 20px;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      
      .email-container {
        max-width: 520px;
        margin: 40px auto;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .content {
        padding: 40px 32px;
        background: #ffffff;
      }
      
      .greeting {
        font-size: 16px;
        color: #374151;
        margin-bottom: 24px;
        font-weight: 500;
      }
      
      .description {
        font-size: 14px;
        color: #6b7280;
        line-height: 1.6;
        margin-bottom: 32px;
      }
      
      .code-container {
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        border-radius: 16px;
        padding: 24px;
        margin: 32px 0;
        text-align: center;
        position: relative;
        border: 2px solid rgba(139, 0, 0, 0.1);
      }
      
      .code-container::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(135deg, #8B0000, #dc2626);
        border-radius: 16px;
        z-index: -1;
        opacity: 0.1;
      }
      
      .verification-code {
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 32px;
        font-weight: 700;
        color: #8B0000;
        letter-spacing: 4px;
        margin: 0;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }
      
      .warning {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border-left: 4px solid #f59e0b;
        padding: 16px 20px;
        border-radius: 0 12px 12px 0;
        margin: 24px 0;
      }
      
      .warning-title {
        font-size: 14px;
        font-weight: 600;
        color: #92400e;
        margin-bottom: 8px;
      }
      
      .warning-text {
        font-size: 13px;
        color: #a16207;
        line-height: 1.5;
        margin-bottom: 8px;
      }
      
      .warning-text:last-child {
        margin-bottom: 0;
      }
      
      .divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
        margin: 32px 0;
      }
      
      .help-section {
        text-align: center;
        padding: 24px 0;
      }
      
      .help-text {
        font-size: 13px;
        color: #9ca3af;
        line-height: 1.5;
      }
      
      .help-link {
        color: #8B0000;
        text-decoration: none;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .help-link:hover {
        color: #660000;
        text-decoration: underline;
      }
      
      .footer {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        padding: 24px 32px;
        text-align: center;
        border-top: 1px solid rgba(226, 232, 240, 0.8);
      }
      
      .footer-text {
        font-size: 12px;
        color: #64748b;
        line-height: 1.6;
        margin-bottom: 8px;
      }
      
      .footer-link {
        color: #8B0000;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s ease;
      }
      
      .footer-link:hover {
        color: #660000;
      }
      
      @media only screen and (max-width: 600px) {
        .email-container {
          margin: 20px auto;
          border-radius: 16px;
        }
        
        .header {
          padding: 24px 20px;
        }
        
        .content {
          padding: 32px 24px;
        }
        
        .verification-code {
          font-size: 28px;
          letter-spacing: 2px;
        }
        
        .footer {
          padding: 20px 24px;
        }
      }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="content">
      <div class="greeting">Bonjour,</div>
      <div class="description">
        Voici votre code de vérification pour votre compte Yunoa.xyz. Utilisez ce code pour compléter votre processus de vérification.
      </div>
      <div class="code-container">
        <div class="verification-code">${code}</div>
      </div>
      <div class="warning">
        <div class="warning-title">⚠️ Important</div>
        <div class="warning-text">Ne partagez jamais ce code avec qui que ce soit.</div>
        <div class="warning-text">Ce code est valide pendant 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.</div>
        <div class="warning-text">Yunoa.xyz ne vous demandera jamais de partager vos codes de vérification.</div>
      </div>
      <div class="divider"></div>
      <div class="help-section">
        <div class="help-text">
          Besoin d'aide ? <a href="mailto:support@yunoa.xyz" class="help-link">Contactez notre équipe</a> ou visitez notre <a href="https://yunoa.xyz/help" class="help-link">centre d'aide</a>.
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-text">Envoyé par Yunoa.xyz • © Yunoa 2025</div>
      <div class="footer-text">Yunoa.xyz Votre plateforme de confiance</div>
    </div>
  </div>
</body>
</html>`;
}

function getWelcomeTemplate(email: string): string {
  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Bienvenue sur Yunoa.xyz !</title>
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style type="text/css">
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        min-height: 100vh; padding: 20px;
        -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;
      }
      .email-container {
        max-width: 520px; margin: 40px auto;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px); border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .content { padding: 40px 32px; background: #ffffff; }
      .greeting { font-size: 18px; color: #374151; margin-bottom: 24px; font-weight: 600; }
      .description { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 32px; }
      .success-icon {
        width: 64px; height: 64px; background: linear-gradient(135deg, #10b981, #059669);
        border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center;
        justify-content: center; color: white; font-size: 24px;
      }
      .welcome-button {
        display: inline-block; background: linear-gradient(135deg, #8B0000, #dc2626);
        color: white; text-decoration: none; padding: 16px 32px;
        border-radius: 12px; font-weight: 600; font-size: 16px;
        text-align: center; margin: 24px 0;
        box-shadow: 0 4px 12px rgba(139, 0, 0, 0.3);
      }
      .footer {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        padding: 24px 32px; text-align: center;
        border-top: 1px solid rgba(226, 232, 240, 0.8);
      }
      .footer-text { font-size: 12px; color: #64748b; line-height: 1.6; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="content">
      <div style="text-align: center;">
        <div class="success-icon">✓</div>
      </div>
      <div class="greeting">Bienvenue sur Yunoa.xyz !</div>
      <div class="description">
        Votre compte a été créé avec succès pour l'adresse email ${email}. Vous pouvez maintenant profiter de tous nos contenus exclusifs.
      </div>
      <div style="text-align: center;">
        <a href="https://yunoa.xyz/" class="welcome-button">Découvrir Yunoa</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-text">Envoyé par Yunoa.xyz • © Yunoa 2025</div>
      <div class="footer-text">Yunoa.xyz Votre plateforme de confiance</div>
    </div>
  </div>
</body>
</html>`;
}

function getPasswordResetTemplate(resetLink: string): string {
  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Réinitialisation de mot de passe - Yunoa.xyz</title>
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style type="text/css">
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        min-height: 100vh;
        padding: 20px;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      
      .email-container {
        max-width: 520px;
        margin: 40px auto;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .content {
        padding: 40px 32px;
        background: #ffffff;
      }
      
      .greeting {
        font-size: 16px;
        color: #374151;
        margin-bottom: 24px;
        font-weight: 500;
      }
      
      .description {
        font-size: 14px;
        color: #6b7280;
        line-height: 1.6;
        margin-bottom: 32px;
      }
      
      .reset-button {
        display: inline-block;
        background: linear-gradient(135deg, #8B0000, #dc2626);
        color: white;
        text-decoration: none;
        padding: 16px 32px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 16px;
        text-align: center;
        margin: 24px 0;
        box-shadow: 0 4px 12px rgba(139, 0, 0, 0.3);
        transition: all 0.2s ease;
      }
      
      .reset-button:hover {
        background: linear-gradient(135deg, #660000, #b91c1c);
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(139, 0, 0, 0.4);
      }
      
      .warning {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border-left: 4px solid #f59e0b;
        padding: 16px 20px;
        border-radius: 0 12px 12px 0;
        margin: 24px 0;
      }
      
      .warning-title {
        font-size: 14px;
        font-weight: 600;
        color: #92400e;
        margin-bottom: 8px;
      }
      
      .warning-text {
        font-size: 13px;
        color: #a16207;
        line-height: 1.5;
        margin-bottom: 8px;
      }
      
      .warning-text:last-child {
        margin-bottom: 0;
      }
      
      .divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
        margin: 32px 0;
      }
      
      .help-section {
        text-align: center;
        padding: 24px 0;
      }
      
      .help-text {
        font-size: 13px;
        color: #9ca3af;
        line-height: 1.5;
      }
      
      .help-link {
        color: #8B0000;
        text-decoration: none;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .help-link:hover {
        color: #660000;
        text-decoration: underline;
      }
      
      .footer {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        padding: 24px 32px;
        text-align: center;
        border-top: 1px solid rgba(226, 232, 240, 0.8);
      }
      
      .footer-text {
        font-size: 12px;
        color: #64748b;
        line-height: 1.6;
        margin-bottom: 8px;
      }
      
      .footer-link {
        color: #8B0000;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s ease;
      }
      
      .footer-link:hover {
        color: #660000;
      }
      
      @media only screen and (max-width: 600px) {
        .email-container {
          margin: 20px auto;
          border-radius: 16px;
        }
        
        .content {
          padding: 32px 24px;
        }
        
        .footer {
          padding: 20px 24px;
        }
      }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="content">
      <div class="greeting">Bonjour,</div>
      <div class="description">
        Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Yunoa.xyz. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
      </div>
      <div style="text-align: center;">
        <a href="${resetLink}" class="reset-button">Réinitialiser mon mot de passe</a>
      </div>
      <div class="warning">
        <div class="warning-title">⚠️ Important</div>
        <div class="warning-text">Ce lien est valide pendant 15 minutes seulement.</div>
        <div class="warning-text">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</div>
        <div class="warning-text">Pour votre sécurité, ne partagez jamais ce lien.</div>
      </div>
      <div class="divider"></div>
      <div class="help-section">
        <div class="help-text">
          Besoin d'aide ? <a href="mailto:support@yunoa.xyz" class="help-link">Contactez notre équipe</a> ou visitez notre <a href="https://yunoa.xyz/help" class="help-link">centre d'aide</a>.
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-text">Envoyé par Yunoa.xyz • © Yunoa 2025</div>
      <div class="footer-text">Yunoa.xyz Votre plateforme de confiance</div>
    </div>
  </div>
</body>
</html>`;
}

// Fonction pour sauvegarder le code de vérification en base
async function saveVerificationCode(email: string, code: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn('Configuration Supabase manquante, code non sauvegardé');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Nettoyer les anciens codes non utilisés pour cet email
    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('email', email)
      .eq('used', false);
    
    // Expiration dans 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    const { error } = await supabase
      .from('email_verification_codes')
      .insert({
        email: email,
        code: code,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (error) {
      console.error('Erreur sauvegarde code:', error);
    } else {
      console.log('💾 Code de vérification sauvegardé:', {
        email: email,
        expires_at: expiresAt.toISOString()
      });
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du code:', error);
  }
}

// Fonction pour vérifier un code de vérification
async function verifyCode(email: string, code: string): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn('Configuration Supabase manquante');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Chercher le code valide et non utilisé
    const { data, error } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return false;
    }

    // Marquer le code comme utilisé
    const { error: updateError } = await supabase
      .from('email_verification_codes')
      .update({ used: true })
      .eq('id', data[0].id);

    if (updateError) {
      console.error('Erreur mise à jour code:', updateError);
      return false;
    }

    console.log('✅ Code vérifié avec succès:', { email, code });
    return true;
  } catch (error) {
    console.error('Erreur vérification code:', error);
    return false;
  }
}

serve(handler);
