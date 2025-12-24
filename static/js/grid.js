// grid.js

// Global storage for initial dimensions
window.initialGridDimensions = null;

// Converted to a global function to be called from uploads.js
window.generateAutoGrid = async function(filepath) {
    const statusEl = document.getElementById('grid-status-msg');
    
    if (!filepath) {
        console.error("No filepath provided for grid generation");
        return;
    }

    if(statusEl) {
        statusEl.textContent = "Calculating grid dimensions...";
        statusEl.className = "small text-info mb-2";
    }

    try {
        const response = await fetch('/grid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filepath: filepath,
                mode: "blind",
            }),
        });

        const result = await response.json();

        if (response.ok) {
            // Save current grid dimensions
            window.gridDimensions = result.grid_dimensions;

            // Save initial grid for reset functionality
            window.initialGridDimensions = Object.assign({}, result.grid_dimensions);

            // Draw the grid box + Axes in the viewer
            if(window.viewer) {
                drawGridBox(window.gridDimensions);
                window.viewer.render();
            }

            // Set slider values
            updateSliders(window.gridDimensions);

            // Show the slider container
            document.getElementById('slider-container').style.display = 'block';

            if(statusEl) {
                statusEl.textContent = "Grid Auto-Generated Successfully";
                statusEl.className = "small text-success mb-2";
            }
        } else {
            if(statusEl) {
                statusEl.textContent = result.error || "Grid generation failed";
                statusEl.className = "small text-danger mb-2";
            }
        }
    } catch (error) {
        console.error("Error during grid generation:", error);
        if(statusEl) {
            statusEl.textContent = "Error generating grid.";
            statusEl.className = "small text-danger mb-2";
        }
    }
};

// Function to draw the grid box (Green Cube + Edges + CENTER AXIS STICKS)
function drawGridBox(gridDimensions) {
    if(!window.viewer) return;

    viewer.removeAllShapes();

    const { center_x, center_y, center_z, size_x, size_y, size_z } = gridDimensions;

    // --- 1. Transparent Green Cube ---
    viewer.addBox({
        center: { x: center_x, y: center_y, z: center_z },
        dimensions: { w: size_x, h: size_y, d: size_z },
        color: 'green',
        opacity: 0.3
    });

    // --- 2. Wireframe Edges ---
    const xmin = (center_x - size_x / 2);
    const xmax = (center_x + size_x / 2);
    const ymin = (center_y - size_y / 2);
    const ymax = (center_y + size_y / 2);
    const zmin = (center_z - size_z / 2);
    const zmax = (center_z + size_z / 2);

    const corners = [
        { x: xmin, y: ymin, z: zmin }, { x: xmax, y: ymin, z: zmin },
        { x: xmax, y: ymax, z: zmin }, { x: xmin, y: ymax, z: zmin },
        { x: xmin, y: ymin, z: zmax }, { x: xmax, y: ymin, z: zmax },
        { x: xmax, y: ymax, z: zmax }, { x: xmin, y: ymax, z: zmax },
    ];

    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    edges.forEach(edge => {
        viewer.addLine({
            start: corners[edge[0]],
            end: corners[edge[1]],
            color: 'green',
            linewidth: 3,
            dashed: false,
        });
    });

    // --- 3. Center Axis Sticks (Visual Crosshair) ---
    // Length is calculated to be visible but contained within a reasonable area
    const stickLen = Math.min(size_x, size_y, size_z) * 0.4; 
    
    // X Axis (Red)
    viewer.addLine({
        start: { x: center_x - stickLen, y: center_y, z: center_z },
        end:   { x: center_x + stickLen, y: center_y, z: center_z },
        color: 'red', linewidth: 10
    });
    // Y Axis (Green)
    viewer.addLine({
        start: { x: center_x, y: center_y - stickLen, z: center_z },
        end:   { x: center_x, y: center_y + stickLen, z: center_z },
        color: 'blue', linewidth: 10 // Using Blue for Y to differentiate from Green Box
    });
    // Z Axis (Blue/Yellow)
    viewer.addLine({
        start: { x: center_x, y: center_y, z: center_z - stickLen },
        end:   { x: center_x, y: center_y, z: center_z + stickLen },
        color: 'orange', linewidth: 10
    });


    // --- 4. Update Bottom Text Line ---
    const coordsEl = document.getElementById('grid-live-coords');
    if(coordsEl) {
        coordsEl.innerHTML = `
            <span style="color:#e34949">X: ${center_x.toFixed(2)}</span> &nbsp;|&nbsp; 
            <span style="color:#06a3e3">Y: ${center_y.toFixed(2)}</span> &nbsp;|&nbsp; 
            <span style="color:#df8c22">Z: ${center_z.toFixed(2)}</span>
        `;
    }

    viewer.render();
}

// "Set Full Grid" Button Logic
document.addEventListener('DOMContentLoaded', () => {
    const resetBtn = document.getElementById('reset-grid-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            if (window.initialGridDimensions) {
                window.gridDimensions = Object.assign({}, window.initialGridDimensions);
                drawGridBox(window.gridDimensions);
                if (typeof updateSliders === 'function') {
                    updateSliders(window.gridDimensions);
                }
            } else {
                alert("No initial grid found.");
            }
        });
    }
});