import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1401396270714847261/RR_iRwl2kTinEdeMJyp2zBWCUcpgvqjIJr_7sKRdKUkOFxhrWtI_kl5CreCf0P0Y5r8G";

interface WebhookPayload {
  type: 'movie' | 'series' | 'episode';
  title: string;
  category: string;
  addedBy: string;
  videoUrl: string;
  thumbnail: string;
  episodeNumber?: number;
  seasonNumber?: number;
  seriesTitle?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log("Received webhook payload:", payload);

    let embedData;
    const timestamp = new Date().toISOString();
    const baseUrl = "https://www.yunoa.xyz";

    switch (payload.type) {
      case 'movie':
        embedData = {
          content: null,
          embeds: [
            {
              title: "🔔 Un nouveau Film a été ajouté !",
              description: `> Nom : ${payload.title}\n\n> Genre(s) :  ${payload.category}\n\n> Ajouté par :  ${payload.addedBy}\n\n> Lien Direct : [Regarder le film](${baseUrl}/video/${payload.videoUrl})`,
              color: 577792,
              footer: {
                text: "Nouveautés"
              },
              timestamp: timestamp,
              image: {
                url: payload.thumbnail
              }
            }
          ],
          attachments: []
        };
        break;

      case 'series':
        embedData = {
          content: null,
          embeds: [
            {
              title: "🔔 Une nouvelle Série a été ajoutée !",
              description: `> Nom : ${payload.title}\n> Genre(s) :  ${payload.category}\n> Ajouté par :  ${payload.addedBy}\n\n> Lien Direct : [Regarder la série](${baseUrl}/video/${payload.videoUrl})`,
              color: 15466496,
              footer: {
                text: "Nouveautés"
              },
              timestamp: timestamp,
              image: {
                url: payload.thumbnail
              }
            }
          ],
          attachments: []
        };
        break;

      case 'episode':
        embedData = {
          content: null,
          embeds: [
            {
              title: "🔔 Nouvelle Episode Ajoutée",
              description: `> Nom : ${payload.seriesTitle || payload.title}\n\n> Episode ${payload.episodeNumber} \n\n> Saison ${payload.seasonNumber}\n\n> Genre(s) :  ${payload.category}\n\n> Ajouté par :  ${payload.addedBy}\n\n> Lien Direct : [Regarder la série](${baseUrl}/video/${payload.videoUrl})`,
              color: 13742080,
              footer: {
                text: "Nouveautés"
              },
              timestamp: timestamp,
              image: {
                url: payload.thumbnail
              }
            }
          ],
          attachments: []
        };
        break;

      default:
        throw new Error(`Type de webhook non supporté: ${payload.type}`);
    }

    console.log("Sending to Discord:", JSON.stringify(embedData, null, 2));

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embedData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord webhook error:", response.status, errorText);
      throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }

    console.log("Discord webhook sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Webhook envoyé avec succès" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in discord-webhook function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);