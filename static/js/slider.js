// slider.js - Final Merged Version

document.addEventListener('DOMContentLoaded', function() {
    console.log("Slider.js initialized");

    // 1. YOUR ORIGINAL SLIDER UPDATE FUNCTION
    // We attach it to window so grid.js can call it
    window.updateSliders = function(gridDimensions) {
        const buffer = 100; 

        // Center sliders
        const cx = document.getElementById('center-x-slider');
        if(cx) { cx.max = gridDimensions.center_x + buffer; cx.min = gridDimensions.center_x - buffer; cx.value = gridDimensions.center_x; }
        
        const cy = document.getElementById('center-y-slider');
        if(cy) { cy.max = gridDimensions.center_y + buffer; cy.min = gridDimensions.center_y - buffer; cy.value = gridDimensions.center_y; }
        
        const cz = document.getElementById('center-z-slider');
        if(cz) { cz.max = gridDimensions.center_z + buffer; cz.min = gridDimensions.center_z - buffer; cz.value = gridDimensions.center_z; }

        // Size sliders
        const sx = document.getElementById('size-x-slider');
        if(sx) { sx.max = gridDimensions.size_x + buffer; sx.min = 1; sx.value = gridDimensions.size_x; }
        
        const sy = document.getElementById('size-y-slider');
        if(sy) { sy.max = gridDimensions.size_y + buffer; sy.min = 1; sy.value = gridDimensions.size_y; }
        
        const sz = document.getElementById('size-z-slider');
        if(sz) { sz.max = gridDimensions.size_z + buffer; sz.min = 1; sz.value = gridDimensions.size_z; }

        // Update displayed text values
        document.getElementById('center-x-value').textContent = gridDimensions.center_x.toFixed(5);
        document.getElementById('center-y-value').textContent = gridDimensions.center_y.toFixed(5);
        document.getElementById('center-z-value').textContent = gridDimensions.center_z.toFixed(5);

        document.getElementById('size-x-value').textContent = gridDimensions.size_x.toFixed(5);
        document.getElementById('size-y-value').textContent = gridDimensions.size_y.toFixed(5);
        document.getElementById('size-z-value').textContent = gridDimensions.size_z.toFixed(5);
    };

    // 2. YOUR INDIVIDUAL EVENT LISTENERS
    // Helper to redraw safely
    const safeDraw = (dims) => { if(typeof drawGridBox === 'function') drawGridBox(dims); };

    const elCx = document.getElementById('center-x-slider');
    if(elCx) elCx.addEventListener('input', (e) => {
        if(!window.gridDimensions) window.gridDimensions = {};
        window.gridDimensions.center_x = parseFloat(e.target.value);
        safeDraw(window.gridDimensions);
        document.getElementById('center-x-value').textContent = window.gridDimensions.center_x;
    });

    const elCy = document.getElementById('center-y-slider');
    if(elCy) elCy.addEventListener('input', (e) => {
        if(!window.gridDimensions) window.gridDimensions = {};
        window.gridDimensions.center_y = parseFloat(e.target.value);
        safeDraw(window.gridDimensions);
        document.getElementById('center-y-value').textContent = window.gridDimensions.center_y;
    });

    const elCz = document.getElementById('center-z-slider');
    if(elCz) elCz.addEventListener('input', (e) => {
        if(!window.gridDimensions) window.gridDimensions = {};
        window.gridDimensions.center_z = parseFloat(e.target.value);
        safeDraw(window.gridDimensions);
        document.getElementById('center-z-value').textContent = window.gridDimensions.center_z;
    });

    const elSx = document.getElementById('size-x-slider');
    if(elSx) elSx.addEventListener('input', (e) => {
        if(!window.gridDimensions) window.gridDimensions = {};
        window.gridDimensions.size_x = parseFloat(e.target.value);
        safeDraw(window.gridDimensions);
        document.getElementById('size-x-value').textContent = window.gridDimensions.size_x;
    });

    const elSy = document.getElementById('size-y-slider');
    if(elSy) elSy.addEventListener('input', (e) => {
        if(!window.gridDimensions) window.gridDimensions = {};
        window.gridDimensions.size_y = parseFloat(e.target.value);
        safeDraw(window.gridDimensions);
        document.getElementById('size-y-value').textContent = window.gridDimensions.size_y;
    });

    const elSz = document.getElementById('size-z-slider');
    if(elSz) elSz.addEventListener('input', (e) => {
        if(!window.gridDimensions) window.gridDimensions = {};
        window.gridDimensions.size_z = parseFloat(e.target.value);
        safeDraw(window.gridDimensions);
        document.getElementById('size-z-value').textContent = window.gridDimensions.size_z;
    });

    // 3. PREPARE RECEPTOR BUTTON (The Fix)
    const prepBtn = document.getElementById('prepare-receptor-btn');
    if (prepBtn) {
        prepBtn.addEventListener('click', async function () {
            console.log("Prepare Button Clicked"); 

            if (!window.gridDimensions || !window.uploadedFilePath) {
                alert("Please generate the grid first.");
                return;
            }

            const btn = this;
            const originalText = btn.innerHTML;
            
            // UI Loading
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Preparing...';
            const statusMsg = document.getElementById('grid-status-msg');
            if(statusMsg) {
                statusMsg.textContent = "Running MGLTools...";
                statusMsg.className = "small text-warning mb-2";
            }

            // Get values directly from inputs to be safe
            const gridData = {
                center_x: parseFloat(document.getElementById('center-x-slider').value),
                center_y: parseFloat(document.getElementById('center-y-slider').value),
                center_z: parseFloat(document.getElementById('center-z-slider').value),
                size_x: parseFloat(document.getElementById('size-x-slider').value),
                size_y: parseFloat(document.getElementById('size-y-slider').value),
                size_z: parseFloat(document.getElementById('size-z-slider').value),
            };

            try {
                const res = await fetch('/prepare_receptor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filepath: window.uploadedFilePath, grid: gridData })
                });

                const data = await res.json();

                if (res.ok) {
                    if(statusMsg) {
                        statusMsg.textContent = "Success!";
                        statusMsg.className = "small text-success mb-2";
                    }
                    
                    // FORCE NAVIGATION TO STEP 2
                    if (typeof unlockStep === "function") {
                        unlockStep(2);
                    } else {
                        // Fallback logic
                        const step2Btn = document.getElementById('btn-step-2');
                        if(step2Btn) {
                            step2Btn.classList.remove('disabled');
                            step2Btn.click();
                        }
                    }
                } else {
                    alert("Error: " + data.error);
                    if(statusMsg) statusMsg.textContent = "Failed.";
                }
            } catch (err) {
                console.error(err);
                alert("Network Error: Check console.");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    // 4. RESET BUTTON (Keep this too)
    const resetBtn = document.getElementById('reset-grid-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            if (window.initialGridDimensions) {
                window.gridDimensions = Object.assign({}, window.initialGridDimensions);
                safeDraw(window.gridDimensions);
                window.updateSliders(window.gridDimensions);
            }
        });
    }

});