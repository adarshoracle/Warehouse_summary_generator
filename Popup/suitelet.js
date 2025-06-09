define(['N/ui/serverWidget', 'N/record', 'N/llm', 'N/log',
        './handlers/poSummary', './handlers/waveSummary', './handlers/soSummary'],
function(serverWidget, recordModule, llm, log, poSummary, waveSummary, soSummary) {

    function onRequest(context) {
        var request = context.request;

        if (request.method === 'GET') {
            var recordId = request.parameters.recordId;
            var recordType = request.parameters.recordType;

            let summary = '';

            if (recordType === 'purchaseorder') {
                summary = poSummary.generateSummary(recordId);
            } else if (recordType === 'wave') {
                summary = waveSummary.generateSummary(recordId);
            } else if (recordType === 'salesorder') {
                summary = soSummary.generateSummary(recordId);
            } else {
                summary = 'Unsupported record type.';
            }

            context.response.write(JSON.stringify({ summary: summary }));
        }
    }

    return {
        onRequest: onRequest
    };
});
