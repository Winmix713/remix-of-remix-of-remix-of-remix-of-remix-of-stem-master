import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to validate URL format
function isValidUrl(urlString: string): { valid: boolean; reason?: string } {
  try {
    // Check for common issues
    if (!urlString || typeof urlString !== 'string') {
      return { valid: false, reason: 'URL must be a non-empty string' };
    }

    if (urlString.includes('undefined')) {
      return { valid: false, reason: 'URL contains "undefined"' };
    }

    // Try to construct URL to validate format
    const url = new URL(urlString);

    // Check for valid protocol
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, reason: 'URL must use http or https protocol' };
    }

    // Check for valid hostname
    if (!url.hostname) {
      return { valid: false, reason: 'URL must have a valid hostname' };
    }

    return { valid: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Invalid URL format';
    return { valid: false, reason: errorMsg };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate AUDIO_SPLITTER_API_URL first
    const AUDIO_SPLITTER_API_URL = Deno.env.get("AUDIO_SPLITTER_API_URL");
    if (!AUDIO_SPLITTER_API_URL) {
      console.error("AUDIO_SPLITTER_API_URL environment variable is not set");
      return new Response(
        JSON.stringify({
          error: "AUDIO_SPLITTER_API_URL is not configured",
          details: "The backend audio processing service URL is not set. Please configure the AUDIO_SPLITTER_API_URL environment variable with your FastAPI backend URL (e.g., http://localhost:8000 for local development).",
          errorType: "MISSING_BACKEND_CONFIG",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Validate that AUDIO_SPLITTER_API_URL is a valid URL
    const backendUrlValidation = isValidUrl(AUDIO_SPLITTER_API_URL);
    if (!backendUrlValidation.valid) {
      console.error("AUDIO_SPLITTER_API_URL is not a valid URL:", backendUrlValidation.reason);
      return new Response(
        JSON.stringify({
          error: "Invalid AUDIO_SPLITTER_API_URL format",
          details: `The backend URL is not valid: ${backendUrlValidation.reason}`,
          errorType: "INVALID_BACKEND_URL",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));

    const { audioUrl, modelName = "htdemucs_ft", outputFormat = "mp3" } = body;

    if (!audioUrl) {
      return new Response(
        JSON.stringify({
          error: "Missing required field: audioUrl",
          errorType: "MISSING_AUDIO_URL",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate audioUrl format before attempting fetch
    const audioUrlValidation = isValidUrl(audioUrl);
    if (!audioUrlValidation.valid) {
      console.error("Invalid audioUrl format:", audioUrlValidation.reason);
      return new Response(
        JSON.stringify({
          error: "Invalid audio URL format",
          details: `The audio URL is not valid: ${audioUrlValidation.reason}. Make sure the Supabase storage is configured correctly and the file was uploaded successfully.`,
          errorType: "INVALID_AUDIO_URL",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Starting stem separation for:", audioUrl);
    console.log("Using model:", modelName);

    // Download the audio file from the URL
    console.log("Downloading audio file from:", audioUrl);
    let audioResponse: Response;
    try {
      audioResponse = await fetch(audioUrl);
    } catch (fetchError) {
      console.error("Failed to fetch audio file:", fetchError);
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      return new Response(
        JSON.stringify({
          error: "Failed to download audio file",
          details: `Could not download the audio file from the storage URL: ${errorMsg}. This may indicate a network issue or the audio file is no longer available.`,
          errorType: "AUDIO_DOWNLOAD_FAILED",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!audioResponse.ok) {
      console.error(`Audio download failed with status ${audioResponse.status}`);
      return new Response(
        JSON.stringify({
          error: "Failed to download audio file",
          details: `The server returned status ${audioResponse.status}. The audio file may not exist or may not be accessible.`,
          errorType: "AUDIO_DOWNLOAD_HTTP_ERROR",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
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
    let separationResponse: Response;
    try {
      separationResponse = await fetch(`${AUDIO_SPLITTER_API_URL}/api/separate`, {
        method: "POST",
        body: formData,
      });
    } catch (fetchError) {
      console.error("Failed to connect to FastAPI backend:", fetchError);
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      return new Response(
        JSON.stringify({
          error: "Backend server unreachable",
          details: `Could not connect to the audio processing backend at ${AUDIO_SPLITTER_API_URL}: ${errorMsg}. Make sure the FastAPI backend is running and accessible.`,
          errorType: "BACKEND_CONNECTION_FAILED",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!separationResponse.ok) {
      let errorText = '';
      try {
        errorText = await separationResponse.text();
      } catch {
        errorText = 'Unable to read error response';
      }
      console.error(`FastAPI error (${separationResponse.status}):`, errorText);
      return new Response(
        JSON.stringify({
          error: "Audio processing failed",
          details: `The FastAPI backend returned an error: ${errorText}`,
          errorType: "PROCESSING_FAILED",
          statusCode: separationResponse.status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
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
    console.error("Unexpected error in stem-separation function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: errorMessage,
        errorType: "UNEXPECTED_ERROR",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
