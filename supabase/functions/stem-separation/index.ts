import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      console.error("REPLICATE_API_KEY is not set");
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));

    // Check prediction status
    if (body.predictionId) {
      console.log("Checking status for prediction:", body.predictionId);
      const prediction = await replicate.predictions.get(body.predictionId);
      console.log("Prediction status:", prediction.status);
      return new Response(JSON.stringify(prediction), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Start new stem separation
    if (!body.audioUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required field: audioUrl" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Starting stem separation for:", body.audioUrl);

    // Use the run method with full model version for Demucs
    // The model identifier format: owner/model:version
    const output = await replicate.run(
      "cjwbw/demucs:abf8fe28e407afa6d8e41e86a759caccc0af8e49c3c68016006b62cb0968441e",
      {
        input: {
          audio: body.audioUrl,
          model_name: body.modelName || "htdemucs",
          stem: body.stem || undefined,
          clip_mode: body.clipMode || "rescale",
          shifts: body.shifts || 1,
          overlap: body.overlap || 0.25,
          mp3_bitrate: body.mp3Bitrate || 320,
          output_format: body.outputFormat || "mp3",
        },
      }
    );

    console.log("Stem separation completed:", JSON.stringify(output));

    return new Response(JSON.stringify({ output, status: "succeeded" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in stem-separation function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
