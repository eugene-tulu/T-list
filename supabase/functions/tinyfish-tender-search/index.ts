// @ts-nocheck
/* eslint-disable */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sector, url, agentId, country = 'Singapore' } = await req.json();

    if (!sector || !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sector and URL are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      console.error('TINYFISH_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const goal = `TASK: Extract government tenders in ${country} for the field of ${sector}.

CURRENT DATE: ${currentDate}
IMPORTANT: Only return tenders with submission deadlines that are AFTER today's date.

RULES:
1) Focus only on relevant tender information for ${sector}
2) Stay on the page and minimize navigation
3) Scroll through the page to find tenders
4) Be fast and efficient
5) Find tenders with upcoming deadlines

Return JSON:
{
  "tenderdetails": [
    {
      "Tender Title": "Full title of the tender",
      "Tender ID": "Official tender reference number",
      "Issuing Authority": "Government agency",
      "Country / Region": "${country}",
      "Tender Type": "Open/Selective/Limited",
      "Publication Date": "Date published",
      "Submission Deadline": "Last date to submit",
      "Tender Status": "Open/Closed",
      "Official Tender URL": "Direct link",
      "Brief Description": "Short summary",
      "Eligibility Criteria": "Requirements",
      "Industry / Category": "${sector}"
    }
  ]
}`;

    console.log(`[${agentId}] Starting TinyFish agent for ${url}`);

    // Create a streaming response to forward TinyFish SSE events
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify({ url, goal }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[${agentId}] TinyFish API error:`, response.status, errorText);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'ERROR', 
              agentId, 
              error: `TinyFish API error: ${response.status}` 
            })}\n\n`));
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    // Forward STARTED event
                    if (data.type === 'STARTED') {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'STARTED', 
                        agentId, 
                        run_id: data.run_id,
                        timestamp: data.timestamp 
                      })}\n\n`));
                    }

                    // Forward streaming URL (TinyFish uses snake_case: streaming_url)
                    if (data.type === 'STREAMING_URL' && data.streaming_url) {
                      console.log(`[${agentId}] Got streaming URL:`, data.streaming_url);
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'STREAMING_URL', 
                        agentId, 
                        streamingUrl: data.streaming_url, // transform to camelCase for client
                        run_id: data.run_id,
                        timestamp: data.timestamp 
                      })}\n\n`));
                    }

                    // Forward PROGRESS events as STATUS updates (transform purpose -> message)
                    if (data.type === 'PROGRESS' && data.purpose) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'STATUS', // Transform to STATUS for backward compatibility with hook
                        agentId, 
                        message: data.purpose, // transform purpose to message
                        run_id: data.run_id,
                        timestamp: data.timestamp 
                      })}\n\n`));
                    }

                    // Forward HEARTBEAT events (optional, can be ignored by hook)
                    if (data.type === 'HEARTBEAT') {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'HEARTBEAT', 
                        agentId, 
                        timestamp: data.timestamp 
                      })}\n\n`));
                    }

                    // Handle completion with results
                    if (data.type === 'COMPLETE') {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      let tenders: any[] = [];
                      
                      // Try multiple possible result field names (TinyFish API variation)
                      let resultData = data.result || data.resultJson;
                      
                      // Log EVERYTHING for debugging
                      console.log(`[${agentId}] COMPLETE event full data:`, JSON.stringify(data, null, 2));
                      console.log(`[${agentId}] COMPLETE raw result field:`, resultData);
                      console.log(`[${agentId}] result type:`, typeof resultData);
                      
                      if (resultData) {
                        // Handle string results (LLM might return JSON as string)
                        if (typeof resultData === 'string') {
                          try {
                            // Try to extract JSON from markdown code blocks
                            const jsonMatch = resultData.match(/```json\s*([\s\S]*?)\s*```/) || 
                                             resultData.match(/```\s*([\s\S]*?)\s*```/);
                            if (jsonMatch) {
                              console.log(`[${agentId}] Found JSON in markdown codeblock`);
                              resultData = JSON.parse(jsonMatch[1]);
                            } else {
                              console.log(`[${agentId}] Attempting direct JSON parse of string`);
                              resultData = JSON.parse(resultData);
                            }
                            console.log(`[${agentId}] Parsed result data:`, resultData);
                          } catch (e) {
                            console.error(`[${agentId}] Failed to parse result:`, e);
                            console.error(`[${agentId}] Raw string that failed:`, resultData);
                            resultData = null;
                          }
                        }
                        
                        // Extract tenderdetails array
                        if (resultData?.tenderdetails && Array.isArray(resultData.tenderdetails)) {
                          tenders = resultData.tenderdetails;
                          console.log(`[${agentId}] Extracted ${tenders.length} tenders from tenderdetails`);
                        } else if (Array.isArray(resultData)) {
                          tenders = resultData;
                          console.log(`[${agentId}] Extracted ${tenders.length} tenders from direct array`);
                        } else {
                          console.warn(`[${agentId}] No tenders found in result. Result keys:`, resultData ? Object.keys(resultData) : 'null');
                        }
                      } else {
                        console.warn(`[${agentId}] COMPLETE with no result field`);
                      }

                      console.log(`[${agentId}] Final tender count: ${tenders.length}`);
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'COMPLETE', 
                        agentId, 
                        tenders,
                        status: data.status || 'COMPLETED',
                        error: data.error,
                        run_id: data.run_id,
                        timestamp: data.timestamp 
                      })}\n\n`));
                    }

                    // Handle errors from TinyFish
                    if (data.type === 'ERROR' || data.error) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'ERROR', 
                        agentId, 
                        error: data.error || (data as any).message || 'Unknown error from TinyFish'
                      })}\n\n`));
                    }

                    // Handle DONE (final event from TinyFish)
                    if (data.type === 'DONE') {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'DONE', 
                        agentId,
                        run_id: data.run_id,
                        timestamp: data.timestamp 
                      })}\n\n`));
                    }
                  } catch (e) {
                    // Ignore parsing errors for individual lines
                    console.error(`[${agentId}] Failed to parse SSE line:`, e);
                  }
                }
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'DONE', agentId })}\n\n`));
          controller.close();
        } catch (error) {
          console.error(`[${agentId}] Stream error:`, error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'ERROR', 
            agentId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in tinyfish-tender-search:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
