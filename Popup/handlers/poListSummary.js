/**
List-wise Purchase Order Summary Generator
Summarizes POs for:
    Aging POs
    Exception Rate
    Average Processing Time
    Vendor On-Time Rate
    Average PO Fulfillment Rate
    // author: Adarsh Kumar
 */

define(['N/search', 'N/llm', 'N/log', 'N/format'], function (search, llm, log, format) {


    function getLatestReceiptDetailsByPO(poIds) {
        const receiptSearch = search.create({
            type: search.Type.ITEM_RECEIPT,
            filters: [
                ['createdfrom', search.Operator.ANYOF, poIds],
                'AND',
                ['mainline', search.Operator.IS, false] // Only line-level data
            ],
            columns: [
                search.createColumn({
                    name: 'createdfrom',
                    summary: search.Summary.GROUP
                }),
                search.createColumn({
                    name: 'trandate',
                    summary: search.Summary.MAX
                }),
                search.createColumn({
                    name: 'quantity',
                    summary: search.Summary.SUM
                })
            ]
        });

        const latestReceiptMap = {};

        receiptSearch.run().each(result => {
            const poId = result.getValue({
                name: 'createdfrom',
                summary: search.Summary.GROUP
            });

            const latestDate = result.getValue({
                name: 'trandate',
                summary: search.Summary.MAX
            });

            const totalReceivedQty = parseFloat(result.getValue({
                name: 'quantity',
                summary: search.Summary.SUM
            })) || 0;

            latestReceiptMap[poId] = {
                latestDate,
                totalReceivedQty
            };

            return true;
        });

        return latestReceiptMap;
    }

    function logLargeObject(title, obj) {
        const str = JSON.stringify(obj);
        const chunkSize = 1000;
        for (let i = 0; i < str.length; i += chunkSize) {
            log.debug(`${title} - part ${i / chunkSize + 1}`, str.substring(i, i + chunkSize));
        }
    }




    function generateListSummary() {
        try {

            log.debug('debug 1');

            const poIds = [];
            const tempResults = [];

            const poSearch = search.create({
                type: search.Type.PURCHASE_ORDER,
                filters: [
                    ['mainline', search.Operator.IS, false],
                    'AND',
                    ['type', search.Operator.ANYOF, 'PurchOrd']
                ],
                columns: [
                    search.createColumn({ name: 'internalid', label: 'PO Internal ID' }),
                    search.createColumn({ name: 'tranid', label: 'PO Number' }),
                    search.createColumn({ name: 'status', label: 'PO Status' }),
                    search.createColumn({ name: 'entity', label: 'Vendor Name' }),
                    search.createColumn({ name: 'quantity', label: 'Ordered Quantity' }),
                    search.createColumn({ name: 'quantityshiprecv', label: 'Received Quantity' }),
                    search.createColumn({ name: 'trandate', label: 'PO Creation Date' }),
                    search.createColumn({ name: 'expectedreceiptdate', label: 'Expected Receipt Date' })
                ]
            });

            log.debug('debug 2');

            poSearch.run().each(result => {
                const poId = result.id;
                poIds.push(poId);

                tempResults.push({
                    id: poId,
                    trandate: result.getValue({ name: 'trandate' }),
                    status: result.getText({ name: 'status' }),
                    vendor: result.getText({ name: 'entity' }),
                    expectedReceipt: result.getValue({ name: 'expectedreceiptdate' }),
                    quantity: parseFloat(result.getValue({ name: 'quantity' })) || 0,
                    quantityReceived: parseFloat(result.getValue({ name: 'quantityshiprecv' })) || 0
                });

                return true;
            });

            log.debug('debug 3');
            // STEP 2: Fetch latest receipt dates and total received quantity
            const latestReceiptMap = getLatestReceiptDetailsByPO(poIds);

            log.debug('debug 4');
            // STEP 3: Final PO result assembly with `latestReceiptDate` and `isFullyReceived`
            const results = tempResults.map(po => {
                const receiptInfo = latestReceiptMap[po.id] || {};

                return {
                    ...po,
                    latestReceiptDate: receiptInfo.latestDate || null,
                    isFullyReceived:
                        receiptInfo.totalReceivedQty !== undefined
                            ? receiptInfo.totalReceivedQty >= po.quantity
                            : false
                };
            });

        const totalPOs = results.length;

        // utility functions to calculate KPIs
        const agingPOs = calculateAgingPOs(results);
        // const exceptionRate = calculateExceptionRate(results);
        const vendorOnTimeRate = calculateVendorOnTimeRate(results);
        const vendorWiseOnTimeRates = calculateVendorWiseOnTimeRates(results);
        const avgFulfillmentRate = calculateAverageFulfillmentRate(results);
        const avgProcessingTime = calculateAverageProcessingTime(results);

        log.debug('debug 5');

        // return data;



        // Generating LLM Summary Prompt
        const prompt = `You are an expert in analyzing Purchase Orders in NetSuite. Based on the following statistics, generate a clear and professional list-wise summary.

                        - Total POs: ${totalPOs}
                        - Aging POs (>10 days): ${agingPOs.count}
                        - Average Processing Time: ${avgProcessingTime} days
                        - Vendor On-Time Rate: ${vendorOnTimeRate}%
                        - Average Fulfillment Rate: ${avgFulfillmentRate}%`;

        const summary = llm.generateText({
            preamble: 'You are an assistant that summarizes PO performance.',
            prompt: prompt,
            modelFamily: llm.ModelFamily.COHERE_COMMAND_R_PLUS,
            modelParameters: {
            maxTokens: 1000,
            temperature: 0.3,
            topK: 0,
            topP: 1
            }
        }).text;


        const data = {
            totalPOs,
            agingPOs,
            avgProcessingTime,
            vendorOnTimeRate,
            vendorWiseOnTimeRates,
            avgFulfillmentRate,
            results,
            summary
        };

        logLargeObject('List-wise PO Summary Data', data);
        return summary;

        } catch (e) {
            log.error('List PO Summary Failed', e);
            return 'Error generating list summary: ' + e.message;
        }
    }

    function calculateAgingPOs(results) {
        const thresholdDays = 10;
        const now = new Date();
        const aged = results.filter(r => {
            const created = new Date(r.trandate);
            const diff = (now - created) / (1000 * 60 * 60 * 24);// convert milliseconds to days
            return r.status !== 'Closed' && diff > thresholdDays;
        });
        return {
            count: aged.length,
            ids: aged.map(r => r.id)
        };
        // returning the ids of POs that are aged more than 10 days
    }

    // function calculateExceptionRate(results) {
    //     const exceptions = results.filter(r => r.exceptionFlag === true || r.exceptionFlag === 'T');
    //     const rate = (exceptions.length / results.length) * 100;
    //     return rate.toFixed(2);
    //     //
    // }

    function calculateVendorOnTimeRate(results) {
        const onTime = results.filter(r => {
            if (!r.expectedReceipt || !r.actualReceipt)
                return false;
            const expected = new Date(r.expectedReceipt);
            const actual = new Date(r.actualReceipt);
            return actual <= expected;
        });
        const rate = (onTime.length / results.length) * 100;
        return rate.toFixed(2);
    }


    function calculateVendorWiseOnTimeRates(results) {
        const vendorMap = {};

        results.forEach(r => {
            const vendorId = r.vendorId;
            const vendorName = r.vendor;

            if (!vendorId) return;

            if (!vendorMap[vendorId]) {
                vendorMap[vendorId] = {
                    name: vendorName,
                    total: 0,
                    onTime: 0
                };
            }

            if (r.expectedReceipt && r.actualReceipt) {
                const expected = new Date(r.expectedReceipt);
                const actual = new Date(r.actualReceipt);

                vendorMap[vendorId].total++;

                if (actual <= expected) {
                    vendorMap[vendorId].onTime++;
                }
            }
        });

        
        for (const id in vendorMap) {
            const vendor = vendorMap[id];
            vendor.rate = vendor.total > 0 ? ((vendor.onTime / vendor.total) * 100).toFixed(2) : '0.00';
        }

        return vendorMap;
    }

    function calculateAverageProcessingTime(results) {
        const fullyReceivedPOs = results.filter(po => po.isFullyReceived && po.trandate && po.latestReceiptDate);

        const totalDays = fullyReceivedPOs.reduce((sum, po) => {
            const created = new Date(po.trandate);
            const received = new Date(po.latestReceiptDate);
            const diffTime = received - created; // in ms
            const diffDays = diffTime / (1000 * 60 * 60 * 24); // convert ms to days
            return sum + diffDays;
        }, 0);

        const avgDays = fullyReceivedPOs.length > 0 ? (totalDays / fullyReceivedPOs.length) : 0;
        return avgDays.toFixed(2);
    }

    function calculateAverageFulfillmentRate(results) {
        const grouped = {};

        results.forEach(r => {
            if (!grouped[r.id]) {
                grouped[r.id] = { ordered: 0, received: 0 };
            }
            grouped[r.id].ordered += r.quantity;
            grouped[r.id].received += r.quantityReceived;
        });

        const rates = Object.values(grouped).map(po => {
            if (po.ordered === 0) return 0;
            return (po.received / po.ordered) * 100;
        });

        const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
        return avg.toFixed(2);
    }

    return {
        generateListSummary: generateListSummary
    };
});
