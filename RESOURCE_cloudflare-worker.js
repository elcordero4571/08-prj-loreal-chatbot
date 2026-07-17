export default {
  async fetch(request, env) {
    // These headers allow your website to communicate with the Worker.
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // The browser may send an OPTIONS request before the real POST request.
    // This is called a CORS preflight request.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Only allow POST requests to this Worker.
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: {
            message: "Only POST requests are allowed.",
          },
        }),
        {
          status: 405,
          headers: corsHeaders,
        },
      );
    }

    try {
      /*
        Read the OpenAI key from Cloudflare's secure secret storage.

        Do not type the actual key in this file.
        The secret in Cloudflare must be named OPENAI_API_KEY.
      */
      const apiKey = env.OPENAI_API_KEY;

      // Stop and return an error if the Cloudflare secret is missing.
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                "The OPENAI_API_KEY secret is not configured in Cloudflare.",
            },
          }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }

      // Read the JSON information sent from script.js.
      const userInput = await request.json();

      /*
        Make sure the frontend sent a messages array.

        The expected format is:
        {
          messages: [
            { role: "user", content: "Hello" }
          ]
        }
      */
      if (!Array.isArray(userInput.messages)) {
        return new Response(
          JSON.stringify({
            error: {
              message: "The request must include a messages array.",
            },
          }),
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      // OpenAI's Chat Completions endpoint.
      const apiUrl = "https://api.openai.com/v1/chat/completions";

      /*
        Create the information that will be sent to OpenAI.

        The frontend sends the conversation messages.
        The Worker chooses the model so users cannot change it.
      */
      const requestBody = {
        model: "gpt-4.1",
        messages: userInput.messages,
        max_completion_tokens: 400,
      };

      // Send the request from Cloudflare to OpenAI.
      const openAIResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Convert OpenAI's response into a JavaScript object.
      const data = await openAIResponse.json();

      /*
        Return OpenAI's response to your frontend.

        Using openAIResponse.status is important because it lets script.js
        know whether the request succeeded or failed.
      */
      return new Response(JSON.stringify(data), {
        status: openAIResponse.status,
        headers: corsHeaders,
      });
    } catch (error) {
      // This runs if the JSON is invalid or another unexpected error occurs.
      console.error("Worker error:", error);

      return new Response(
        JSON.stringify({
          error: {
            message: "The Worker could not process the request.",
          },
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }
  },
};