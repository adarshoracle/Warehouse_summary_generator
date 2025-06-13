/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/https','N/log'], function(currentRecord, url, https, log) {

    function showStyledPopup(summaryHtml) {
    const existing = document.getElementById('styled-popup');
    if (existing) existing.remove();

    // Format headers: ## Heading → Underlined bold headers
    summaryHtml = summaryHtml.replace(/##\s*(.+)/g, `
        <div style="font-weight:bold; text-decoration:underline; font-size:16px; margin:14px 0 6px 0;">$1</div>
    `);

    // Format bold markdown (**text**) → <strong>text</strong>
    summaryHtml = summaryHtml.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert line breaks
    summaryHtml = summaryHtml.replace(/\n/g, '<br>');

    const popup = document.createElement('div');
    popup.id = 'styled-popup';
    popup.innerHTML = `
        <div style="background-color: #444; color: white; padding: 10px 14px; font-weight: bold; font-size: 15px;">
            Field Help
            <span style="float:right; cursor:pointer; font-size: 18px;" onclick="this.parentElement.parentElement.remove()">&#10006;</span>
        </div>
        <div style="
            padding: 20px;
            background-color: white;
            color: #222;
            font-size: 14px;
            max-height: 600px;
            overflow-y: auto;
            line-height: 1.6;
        ">
            ${summaryHtml}
        </div>
    `;

    Object.assign(popup.style, {
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '700px',  // ← wider popup
        border: '1px solid #999',
        boxShadow: '0 3px 12px rgba(0,0,0,0.3)',

        backgroundColor: '#fff',
        zIndex: 9999,
        fontFamily: 'Arial, sans-serif',
        borderRadius: '6px'
    });

    document.body.appendChild(popup);
}

    function showSummary() {
        var currentRec = currentRecord.get();
        var recordId = currentRec.id;
        var recordType = currentRec.type;

        var suiteletUrl = url.resolveScript({
            scriptId: 'customscript_suitelet_llm',
            deploymentId: 'customdeploy_suitelet_llm',
            params: {
                recordId: recordId,
                recordType: recordType
            }
        });
            console.log('recordType',recordType);
        https.get.promise({ url: suiteletUrl }).then(function(response) {
            var parsed = JSON.parse(response.body);
            
            var summary = typeof parsed.summary === 'string'
                ? parsed.summary
                : JSON.stringify(parsed.summary, null, 2);

            showStyledPopup(`
                <strong>LLM Summary:</strong><br>
                ${summary}
            `);
        }).catch(function(error) {
            console.log('Error:', error.message);
        });

    }

    function pageInit(context) {
        // Only for testing - can remove
        console.log('Client Script Loaded');
    }

    return {
        pageInit: pageInit,
        showSummary: showSummary
    };
});
