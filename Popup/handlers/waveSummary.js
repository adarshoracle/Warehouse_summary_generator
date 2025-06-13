/**
 * Wave Summary Handler
 */

define(['N/record', 'N/llm', 'N/log'], function (recordModule, llm, log) {

    function generateSummary(recordId) {
        try {
            var rec = recordModule.load({
                type: 'wave', // ✅ Replace with actual record type ID if needed
                id: recordId
            });

            var waveNumber = rec.getValue({ fieldId: 'name' });
            var status = rec.getText({ fieldId: 'status' });
            var location = rec.getText({ fieldId: 'location' });
            var createdDate = rec.getValue({ fieldId: 'createddate' });

            var completedDate = 'NULL';
            if (status === 'Completed') {
                completedDate = rec.getValue({ fieldId: 'completeddate' });
            }

            // 🔹 Orders Sublist
            var orderCount = rec.getLineCount({ sublistId: 'waveorders' });
            var orders = [];

            for (var orderIdx = 0; orderIdx < orderCount; orderIdx++) {
                orders.push({
                    id: rec.getSublistText({ sublistId: 'waveorders', fieldId: 'order', line: orderIdx }),
                    date: rec.getSublistValue({ sublistId: 'waveorders', fieldId: 'orderDate', line: orderIdx }),
                    customer: rec.getSublistText({ sublistId: 'waveorders', fieldId: 'orderCustomer', line: orderIdx }),
                    memo: rec.getSublistValue({ sublistId: 'waveorders', fieldId: 'orderMemo', line: orderIdx }),
                    quantity: rec.getSublistValue({ sublistId: 'waveorders', fieldId: 'orderQty', line: orderIdx }),
                    orderId: rec.getSublistValue({ sublistId: 'waveorders', fieldId: 'ordernumberid', line: orderIdx })
                });
                log.debug('Order Info', JSON.stringify(orders[orderIdx]));
            }

            // 🔹 Sales Order Items Extraction
           var items = [];
for (var ordIdx = 0; ordIdx < orders.length; ordIdx++) {
    var orderId = orders[ordIdx].orderId;
    var soRec = recordModule.load({
        type: 'salesorder',
        id: orderId
    });

    var soItemCount = soRec.getLineCount({ sublistId: 'item' });
    for (var itemIdx = 0; itemIdx < soItemCount; itemIdx++) {
        var itemObj = {
            orderId: orderId,
            orderName: orders[ordIdx].id,  // also include SO external ID / number
            item: soRec.getSublistText({ sublistId: 'item', fieldId: 'item', line: itemIdx }),
            backOrder: soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantitybackordered', line: itemIdx }),
            quantity: soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: itemIdx })
        };
        items.push(itemObj);

        log.debug('Backorder Info', 
            'Order ID: ' + itemObj.orderId + 
            ', Order Name: ' + itemObj.orderName + 
            ', Item: ' + itemObj.item + 
            ', Quantity: ' + itemObj.quantity + 
            ', Backordered: ' + itemObj.backOrder
        );
    }
}


            // 🔹 Line Items Sublist
            var lineItemCount = rec.getLineCount({ sublistId: 'lineitems' });
            var lineItems = [];

            for (var liIdx = 0; liIdx < lineItemCount; liIdx++) {
                lineItems.push({
                    item: rec.getSublistText({ sublistId: 'lineitems', fieldId: 'itemName', line: liIdx }),
                    quantity: rec.getSublistValue({ sublistId: 'lineitems', fieldId: 'quantity', line: liIdx }),
                    order: rec.getSublistValue({ sublistId: 'lineitems', fieldId: 'ordernumber', line: liIdx })
                });
            }

            // 🔹 Pick Tasks Sublist
            var pickTaskCount = rec.getLineCount({ sublistId: 'picktasks' });
            var pickTasks = [];

            for (var ptIdx = 0; ptIdx < pickTaskCount; ptIdx++) {
                pickTasks.push({
                    task: rec.getSublistText({ sublistId: 'picktasks', fieldId: 'picktaskid', line: ptIdx }),
                    status: rec.getSublistText({ sublistId: 'picktasks', fieldId: 'status', line: ptIdx }),
                    bin: rec.getSublistText({ sublistId: 'picktasks', fieldId: 'recommendedBin', line: ptIdx })
                });
            }

            // 🔹 Prompt 1: Basic Wave Summary
            var summaryPrompt0 = `You are a warehouse operations expert. Analyze the wave summary data and generate a clear, professional summary.
Wave Number: ${waveNumber}
Status: ${status}
Location: ${location}
Created Date: ${createdDate}

Orders (${orderCount}):
${orders.map(o =>
                `- Order ID: ${o.id}, Date: ${o.date}, Customer: ${o.customer}, Qty: ${o.quantity}, Memo: ${o.memo}`
            ).join('\n')}

Line Items (${lineItemCount}):
${lineItems.map(li =>
                `- Item: ${li.item}, Quantity: ${li.quantity}, Order#: ${li.order}`
            ).join('\n')}
`;

            const summary0 = llm.generateText({
                preamble: `You are an expert in warehouse wave summaries. Calculate all numerical data accurately using your internal math functions without estimation.`,
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

            // 🔹 Prompt 2: Pick Task Summary
            var summaryPrompt1 = `Create a summary focusing on:
- Status overview
- Pick task progress
- Notable delays or exceptions
- Overall readiness of the wave

Pick Tasks (${pickTaskCount}):
${pickTasks.map(p =>
                `- Task: ${p.task} (Status: ${p.status}, Recommended Bin: ${p.bin})`
            ).join('\n')}

Orders: ${orderCount}`;

            const summary1 = llm.generateText({
                preamble: `You are an expert in analyzing warehouse workflows. Use your internal math functions for accurate calculations with zero errors.`,
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

            // 🔹 Prompt 3: Sales Order Items Summary
            var summaryPrompt2 = `You are an intelligent assistant that generates insightful and professional summaries for sales orders.
Analyze the sales order items details provided below and generate a concise summary.
Number of Items: ${lineItemCount}
Items: 
${items.map(i => 'Item: ' + i.item + ', Back Order: ' + i.backOrder + ', Quantity: ' + i.quantity).join('\n')}

The summary should clearly include the number of items and the backorder items. The backordered part is the most important part of the summary.`;

            const summary2 = llm.generateText({
                preamble: `You are a professional sales order analyst. Generate a concise summary based on the provided details.`,
                prompt: summaryPrompt2,
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

            // 🔹 Final Merge
            var finalPrompt = `You are an expert in warehouse operations. Combine the following draft summaries into a final, professional wave summary:
Summary 1:
${summary0}

Summary 2:
${summary1}

Summary 3:
${summary2}

Return a concise, insightful summary covering status, progress, delays (if any), and overall readiness.`;

            const finalSummary = llm.generateText({
                preamble: `You are an expert in warehouse wave summaries. For example, a summary may look like this: "Wave #235 has 12 orders, 320 items, 4 items pending due to low stock. 2 pickers are assigned. 85% picking completed as of 10 AM. Generate the summary like this with percentages time and everything else included."`,
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

            return finalSummary;

        } catch (e) {
            log.error('Wave Summary Generation Failed', e);
            return 'Error generating wave summary: ' + e.message;
        }
    }

    return {
        generateSummary: generateSummary
    };
});
