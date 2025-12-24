// Function to update sliders based on grid values
function updateSliders(gridDimensions) {

    const buffer = 100; // Optional buffer to allow a bit of leeway on either side

    // Center sliders
    document.getElementById('center-x-slider').max = gridDimensions.center_x + buffer;
    document.getElementById('center-x-slider').min = gridDimensions.center_x - buffer;
    document.getElementById('center-x-slider').value = gridDimensions.center_x;

    document.getElementById('center-y-slider').max = gridDimensions.center_y + buffer;
    document.getElementById('center-y-slider').min = gridDimensions.center_y - buffer;
    document.getElementById('center-y-slider').value = gridDimensions.center_y;

    document.getElementById('center-z-slider').max = gridDimensions.center_z + buffer;
    document.getElementById('center-z-slider').min = gridDimensions.center_z - buffer;
    document.getElementById('center-z-slider').value = gridDimensions.center_z;

    // Size sliders
    document.getElementById('size-x-slider').max = gridDimensions.size_x + buffer;
    document.getElementById('size-x-slider').min = 1;
    document.getElementById('size-x-slider').value = gridDimensions.size_x;

    document.getElementById('size-y-slider').max = gridDimensions.size_y + buffer;
    document.getElementById('size-y-slider').min = 1;
    document.getElementById('size-y-slider').value = gridDimensions.size_y;

    document.getElementById('size-z-slider').max = gridDimensions.size_z + buffer;
    document.getElementById('size-z-slider').min = 1;
    document.getElementById('size-z-slider').value = gridDimensions.size_z;

    // Update the displayed values
    document.getElementById('center-x-value').textContent = gridDimensions.center_x.toFixed(5);
    document.getElementById('center-y-value').textContent = gridDimensions.center_y.toFixed(5);
    document.getElementById('center-z-value').textContent = gridDimensions.center_z.toFixed(5);

    document.getElementById('size-x-value').textContent = gridDimensions.size_x.toFixed(5);
    document.getElementById('size-y-value').textContent = gridDimensions.size_y.toFixed(5);
    document.getElementById('size-z-value').textContent = gridDimensions.size_z.toFixed(5);
}



// Event listeners for sliders
document.getElementById('center-x-slider').addEventListener('input', (e) => {
    let gridDimensions = window.gridDimensions || {};
    gridDimensions.center_x = parseInt(e.target.value, 10);
    drawGridBox(gridDimensions); // Redraw the grid with updated position
    document.getElementById('center-x-value').textContent = gridDimensions.center_x;
});

document.getElementById('center-y-slider').addEventListener('input', (e) => {
    let gridDimensions = window.gridDimensions || {};
    gridDimensions.center_y = parseInt(e.target.value, 10);
    drawGridBox(gridDimensions); // Redraw the grid with updated position
    document.getElementById('center-y-value').textContent = gridDimensions.center_y;
});

document.getElementById('center-z-slider').addEventListener('input', (e) => {
    let gridDimensions = window.gridDimensions || {};
    gridDimensions.center_z = parseInt(e.target.value, 10);
    drawGridBox(gridDimensions); // Redraw the grid with updated position
    document.getElementById('center-z-value').textContent = gridDimensions.center_z;
});

document.getElementById('size-x-slider').addEventListener('input', (e) => {
    let gridDimensions = window.gridDimensions || {};
    gridDimensions.size_x = parseInt(e.target.value, 10);
    drawGridBox(gridDimensions); // Redraw the grid with updated size
    document.getElementById('size-x-value').textContent = gridDimensions.size_x;
});

document.getElementById('size-y-slider').addEventListener('input', (e) => {
    let gridDimensions = window.gridDimensions || {};
    gridDimensions.size_y = parseInt(e.target.value, 10);
    drawGridBox(gridDimensions); // Redraw the grid with updated size
    document.getElementById('size-y-value').textContent = gridDimensions.size_y;
});

document.getElementById('size-z-slider').addEventListener('input', (e) => {
    let gridDimensions = window.gridDimensions || {};
    gridDimensions.size_z = parseInt(e.target.value);
    drawGridBox(gridDimensions); // Redraw the grid with updated size
    document.getElementById('size-z-value').textContent = gridDimensions.size_z;
});

document.getElementById('download-grid-btn').addEventListener('click', async function () {
    if (!window.gridDimensions || !window.uploadedFilePath) {
        alert("Please generate the grid first.");
        return;
    }

    const getValue = (id, fallback) => {
        const el = document.getElementById(id);
        return el && el.value !== '' ? parseFloat(el.value) : fallback;
    };

    const gridData = {
        center_x: getValue('center-x-slider', window.gridDimensions.center_x),
        center_y: getValue('center-y-slider', window.gridDimensions.center_y),
        center_z: getValue('center-z-slider', window.gridDimensions.center_z),
        size_x: getValue('size-x-slider', window.gridDimensions.size_x),
        size_y: getValue('size-y-slider', window.gridDimensions.size_y),
        size_z: getValue('size-z-slider', window.gridDimensions.size_z),
    };

    try {
        const res = await fetch('/save_grid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filepath: window.uploadedFilePath,
                grid: gridData
            })
        });

        if (res.ok) {
            // SUCCESS: Unlock Step 2 and Move there
            // Function defined in action.js
            if (typeof unlockStep === "function") {
                unlockStep(2); 
            }
        }
    } catch (err) {
        console.error("Error saving grid:", err);
        alert("Server error while saving grid.");
    }
});