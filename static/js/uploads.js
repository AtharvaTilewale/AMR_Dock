// uploads.js

// --- Receptor Upload ---
document.getElementById('rec-upload-form').onsubmit = async (event) => {
    event.preventDefault();
    
    const fileInput = document.getElementById('rec-file');
    const uploadBtn = document.getElementById('recUploadBtn');
    const responseEl = document.getElementById('rec-upload-response');

    if (fileInput.files.length === 0) {
        responseEl.textContent = "Please select a file.";
        responseEl.classList.add('text-danger');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";

    try {
        const response = await fetch('/rec_upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (response.ok) {
            responseEl.textContent = "Upload Successful!";
            responseEl.className = "mb-0 mt-1 small text-success";
            
            // 1. Save filepath
            window.uploadedFilePath = result.filepath;

            // 2. REVEAL BOTTOM WORKSPACE (Viewer + Grid Settings)
            const workspace = document.getElementById('step1-bottom-area');
            workspace.style.display = 'flex'; 

            // 3. Load Protein into Viewer
            if (typeof loadProteinStructure === 'function') {
                loadProteinStructure(result.filepath);
            }

            // 4. TRIGGER AUTO GRID
            setTimeout(() => {
                if (typeof window.generateAutoGrid === 'function') {
                    window.generateAutoGrid(result.filepath);
                }
                if(window.viewer) {
                    window.viewer.resize();
                    window.viewer.render();
                }
            }, 100);
            
        } else {
            responseEl.textContent = result.error || "Upload failed.";
            responseEl.className = "mb-0 mt-1 small text-danger";
        }
    } catch (error) {
        console.error(error);
        responseEl.textContent = "Network error.";
        responseEl.className = "mb-0 mt-1 small text-danger";
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload";
    }
};

// --- Ligand Upload ---
document.getElementById('lig-upload-form').onsubmit = async (event) => {
    event.preventDefault();
    const fileInput = document.getElementById('lig-file');
    const files = fileInput.files;
    
    if (files.length === 0) { alert("Select files."); return; }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('files[]', files[i]);

    const btn = document.getElementById('ligUploadBtn');
    btn.disabled = true; btn.innerText = "Uploading...";

    try {
        const response = await fetch('/lig_upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
            document.getElementById('lig-upload-response').textContent = result.message;
            document.getElementById('lig-upload-response').className = "mt-3 text-center text-success";
            if (typeof unlockStep === 'function') unlockStep(3);
            document.getElementById('paramSetBtn').style.display = 'block';
        } else {
            document.getElementById('lig-upload-response').textContent = result.error;
            document.getElementById('lig-upload-response').className = "mt-3 text-center text-danger";
        }
    } catch (error) { console.error(error); } 
    finally { btn.disabled = false; btn.innerText = "Upload Ligands"; }
};

// --- PARAMETER LOGIC ---

// 1. Auto-update Exhaustiveness
// In uploads.js, replace the '--- Params Upload ---' section with this:

// --- PARAMETER LOGIC ---

// 1. Auto-update Exhaustiveness when Search Mode changes
const searchSelect = document.getElementById('search-mode-select');
if (searchSelect) {
    searchSelect.addEventListener('change', function() {
        const mode = this.value;
        const exhaustInput = document.getElementById('exhaustiveness-input');
        if (exhaustInput) {
            if (mode === 'Fast') exhaustInput.value = 4;
            else if (mode === 'Balanced') exhaustInput.value = 8;
            else if (mode === 'Detail') exhaustInput.value = 32;
        }
    });
}

// 2. GPU Checkbox Logic (Toggle Scoring Method)
const gpuCheck = document.getElementById('use-gpu-check');
if (gpuCheck) {
    gpuCheck.addEventListener('change', function() {
        const isGpu = this.checked;
        const scoreSelect = document.getElementById('scoring-method-select');
        const helpText = document.getElementById('scoring-help');

        if (isGpu) {
            scoreSelect.disabled = false;
            helpText.textContent = "Select scoring method for GPU.";
        } else {
            scoreSelect.value = 'vina';
            scoreSelect.disabled = true;
            helpText.textContent = "CPU mode only supports Vina scoring.";
        }
    });
}

// 3. Params Upload Handler
document.getElementById('param-upload-form').addEventListener('submit', function (e) {
    e.preventDefault();
    let formData = new FormData(this);
    
    // Explicitly handle checkbox state
    // We send 'true' or 'false' string so Python can compare it easily
    const isGpu = document.getElementById('use-gpu-check').checked;
    formData.set('use_gpu', isGpu ? 'true' : 'false');
    
    // Ensure scoring method is sent even if the dropdown is disabled (defaults to vina)
    if (!isGpu) {
        formData.set('scoring_method', 'vina');
    }

    fetch('/upload-params', { method: 'POST', body: formData })
    .then(response => response.json())
    .then(data => {
        const responseEl = document.getElementById('param-upload-response');
        if (data.message) {
            responseEl.innerText = data.message;
            responseEl.className = "mt-2 text-center text-success";
            if (typeof unlockStep === 'function') unlockStep(4);
            document.getElementById('goToRunBtn').style.display = 'block';
        } else {
            responseEl.innerText = data.error;
            responseEl.className = "mt-2 text-center text-danger";
        }
    });
});

// --- Run Docking ---
// --- Run Docking ---
document.getElementById('run-docking-btn').addEventListener('click', function() {
    if(typeof setDockingState === "function") setDockingState(true);
    
    const runLoader = document.getElementById('run-loader');
    const logOutput = document.getElementById('log-output');
    
    runLoader.style.display = 'inline-block';
    logOutput.textContent = 'Initializing...';

    // Clear previous status
    document.getElementById('run-final-status').innerHTML = '';
    document.getElementById('download-btn').style.display = 'none';

    let pollingInterval;

    const pollStatus = () => {
        fetch('/run-status')
            .then(r => r.json())
            .then(data => {
                if (data.log) { 
                    logOutput.textContent = data.log; 
                    logOutput.scrollTop = logOutput.scrollHeight; 
                }

                if (data.status !== 'running') {
                    clearInterval(pollingInterval);
                    runLoader.style.display = 'none';
                    if(typeof setDockingState === "function") setDockingState(false);
                    
                    if (data.status === 'completed') {
                        document.getElementById('run-final-status').innerHTML = 
                            `<div class="alert alert-success">Run Completed!</div>`;
                    } else {
                        document.getElementById('run-final-status').innerHTML = 
                            `<div class="alert alert-danger">Run Failed. Check Log.</div>`;
                    }
                }
            })
            .catch(err => {
                console.error("Polling error:", err);
                clearInterval(pollingInterval);
            });
    };

    fetch('/run-docking', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.message) {
                // Start polling
                pollingInterval = setInterval(pollStatus, 3000);
            } else { 
                logOutput.textContent = "Error starting run: " + (data.error || "Unknown error"); 
                if(typeof setDockingState === "function") setDockingState(false); 
                runLoader.style.display = 'none';
            }
        })
        .catch(err => {
            logOutput.textContent = "Network Error calling /run-docking";
            if(typeof setDockingState === "function") setDockingState(false);
            runLoader.style.display = 'none';
        });
});