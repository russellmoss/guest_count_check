// script.js - Handles frontend interactions

document.getElementById("submit-btn").addEventListener("click", async () => {
    const fromDate = document.getElementById("from-date").value;
    const toDate = document.getElementById("to-date").value;
    const statusMessage = document.getElementById("status-message");
    
    if (!fromDate && !toDate) {
        alert("Please select at least one date.");
        return;
    }
    
    statusMessage.style.display = "block";
    statusMessage.textContent = "Loading...";
    
    try {
        // Use relative URL so it works in both development and production
        const url = `/export?from=${fromDate}&to=${toDate}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error("Failed to fetch report");
        }
        
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = "guest_count_report.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        statusMessage.textContent = "Download complete!";
        setTimeout(() => { statusMessage.style.display = "none"; }, 3000);
    } catch (error) {
        console.error("Error:", error);
        statusMessage.textContent = "Error generating report.";
    }
});
