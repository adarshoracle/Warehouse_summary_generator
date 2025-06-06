/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/record', 'N/llm', 'N/log'], function(serverWidget, recordModule, llm, log) {

    function onRequest(context) {
        var request = context.request;

        if (request.method === 'GET') {
            var recordId = request.parameters.recordId;
            var recordType = request.parameters.recordType;

            var rec = recordModule.load({
                type: recordType,
                id: recordId
            });

            log.debug({
                title: 'Loaded Record',
                details: 'Record Type: ' + recordType + ', Record ID: ' + recordId
            });

            var status = rec.getValue({
                fieldId: 'status'
            });

            var location = rec.getText({
                fieldId: 'location'
            });

            var itemCount = rec.getLineCount({
                sublistId: 'item'
            });

            var items = [];

            for (var i = 0; i < itemCount; i++) {
                var item = rec.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                var orderedQuantity = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });

                var receivedQuantity = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantityreceived',
                    line: i
                });

                var amount = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                });

                items.push({
                    item: item,
                    quantity: orderedQuantity,
                    received: receivedQuantity,
                    amount: amount
                });
            }

            // First summary prompt
            var summaryPrompt0 = `
You are an intelligent assistant that generates insightful and professional summaries for purchase orders. 
Analyze the purchase order details provided below.

Status: ${status}
Location: ${location}
Number of Items: ${itemCount}
Items:
${items.map(i => `- ${i.item} (Ordered: ${i.quantity}, Received: ${i.received}, Amount: ${i.amount})`).join('\n')}
`;

            const summary0 = llm.generateText({
                preamble: `You are an expert in summarizing purchase orders.`,
                prompt: summaryPrompt0,
                modelFamily: llm.ModelFamily.COHERE_COMMAND_R_PLUS,
                modelParameters: {
                    maxTokens: 1000,
                    temperature: 0.3,
                    topK: 0,
                    topP: 1,
                    frequencyPenalty: 0,
                    presencePenalty: 0
                }
            }).text;

            // Second summary prompt
            var summaryPrompt1 = `
Summarize the purchase order based on item data.

Include:
- Ordered vs received quantities
- Pending receipts
- Total amount
- High-value items or partially received ones

Items:
${items.map(i => `- ${i.item} (Ordered: ${i.quantity}, Received: ${i.received}, Amount: ${i.amount})`).join('\n')}
`;

            const summary1 = llm.generateText({
                preamble: `You are an expert in summarizing purchase orders.`,
                prompt: summaryPrompt1,
                modelFamily: llm.ModelFamily.COHERE_COMMAND_R_PLUS,
                modelParameters: {
                    maxTokens: 1000,
                    temperature: 0.3,
                    topK: 0,
                    topP: 1,
                    frequencyPenalty: 0,
                    presencePenalty: 0
                }
            }).text;

            // Final merged summary
            var finalPrompt = `
You are an expert in purchase order analysis. Here are two draft summaries:

Summary 1:
${summary0}

Summary 2:
${summary1}

Combine the insights into a single clear, professional summary.
`;

            const summary = llm.generateText({
                preamble: `You are an expert in summarizing purchase orders.`,
                prompt: finalPrompt,
                modelFamily: llm.ModelFamily.COHERE_COMMAND_R_PLUS,
                modelParameters: {
                    maxTokens: 1000,
                    temperature: 0.3,
                    topK: 0,
                    topP: 1,
                    frequencyPenalty: 0,
                    presencePenalty: 0
                }
            }).text;

            context.response.write(JSON.stringify({
                summary: summary
            }));
        }
    }

    return {
        onRequest: onRequest
    };
});
