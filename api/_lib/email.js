import nodemailer from 'nodemailer';

export async function sendVerificationEmail(email, code) {
  try {
    console.log('Attempting to send email to:', email);
    console.log('SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false // Accept self-signed certificates
      }
    });

    // Test the connection
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    const html = getEmailTemplate(code);

    const mailOptions = {
      from: `"Yunoa" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Votre code de vérification - Yunoa.xyz',
      html,
    };

    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email, token) {
  try {
    console.log('Attempting to send password reset email to:', email);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();
    console.log('SMTP connection verified for password reset');

    const resetLink = `https://yunoa.xyz/reset#token=${token}`;
    const html = getPasswordResetTemplate(resetLink);

    const mailOptions = {
      from: `"Yunoa" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Réinitialisation de votre mot de passe - Yunoa.xyz',
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Password reset email sending error:', error);
    throw error;
  }
}

function getEmailTemplate(code) {
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

function getPasswordResetTemplate(resetLink) {
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
