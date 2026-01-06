import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const AUDIO_SPLITTER_API_URL = Deno.env.get("AUDIO_SPLITTER_API_URL");
    if (!AUDIO_SPLITTER_API_URL) {
      console.error("AUDIO_SPLITTER_API_URL is not set");
      throw new Error("AUDIO_SPLITTER_API_URL is not configured. Please set up your FastAPI backend URL.");
    }

    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));

    const { audioUrl, modelName = "htdemucs_ft", outputFormat = "mp3" } = body;

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required field: audioUrl" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Starting stem separation for:", audioUrl);
    console.log("Using model:", modelName);

    // Download the audio file from the URL
    console.log("Downloading audio file...");
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio file: ${audioResponse.status}`);
    }
    const audioBlob = await audioResponse.blob();
    
    // Get filename from URL
    const urlParts = audioUrl.split("/");
    let filename = urlParts[urlParts.length - 1] || "audio.mp3";
    filename = decodeURIComponent(filename);

    // Create FormData to send to FastAPI
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    formData.append("model_name", modelName);
    formData.append("output_format", outputFormat);

    console.log("Sending to FastAPI backend:", AUDIO_SPLITTER_API_URL);

    // Call the FastAPI backend
    const separationResponse = await fetch(`${AUDIO_SPLITTER_API_URL}/api/separate`, {
      method: "POST",
      body: formData,
    });

    if (!separationResponse.ok) {
      const errorText = await separationResponse.text();
      console.error("FastAPI error:", errorText);
      throw new Error(`Separation failed: ${separationResponse.status} - ${errorText}`);
    }

    const result = await separationResponse.json();
    console.log("Stem separation completed:", JSON.stringify(result));

    // Transform the response to match expected format
    // FastAPI returns: { stems: { vocals: "base64...", drums: "base64...", ... }, processing_time: 123 }
    const output: Record<string, string> = {};
    
    if (result.stems) {
      for (const [stemName, stemData] of Object.entries(result.stems)) {
        if (typeof stemData === "string") {
          // If it's a base64 string, create a data URL
          if (stemData.startsWith("data:")) {
            output[stemName] = stemData;
          } else {
            output[stemName] = `data:audio/${outputFormat};base64,${stemData}`;
          }
        } else if (typeof stemData === "object" && stemData !== null && "url" in stemData) {
          // If it's an object with a URL
          output[stemName] = (stemData as { url: string }).url;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        output, 
        status: "succeeded",
        processing_time: result.processing_time 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
