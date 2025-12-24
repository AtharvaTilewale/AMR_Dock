/* action.js */

// State management
let currentStep = 1;
let highestReachedStep = 1;
let isDockingRunning = false;

// Unified Navigation Function
function navToStep(targetStep) {
    // 1. Prevent clicking the same step
    if (targetStep === currentStep) return;

    // 2. Prevent going forward beyond what has been completed
    if (targetStep > highestReachedStep) return;

    // 3. Warning if Docking is currently running and user tries to leave step 4
    if (currentStep === 4 && isDockingRunning && targetStep < 4) {
        const confirmLeave = confirm("Docking is currently running. Leaving this tab will not stop the process, but you might lose the live log view. Continue?");
        if (!confirmLeave) return;
    }

    // 4. Update UI Classes
    updateUI(targetStep);
}

// Update DOM elements based on step
function updateUI(step) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(el => {
        el.classList.remove('active-section');
    });

    // Show target section
    document.getElementById(`section-${step}`).classList.add('active-section');

    // Update Top Buttons
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`btn-step-${i}`);
        
        btn.classList.remove('active', 'completed', 'disabled');

        if (i === step) {
            btn.classList.add('active'); // Current Step (Dark)
        } else if (i < step || i <= highestReachedStep) {
            btn.classList.add('completed'); // Previous accessible steps (Light)
        } else {
            btn.classList.add('disabled'); // Future steps
        }
    }

    currentStep = step;

    // Resize viewer if entering step 1 (needed for 3dmol Canvas resize)
    if (step === 1 && window.viewer) {
        setTimeout(() => {
            window.viewer.resize();
            window.viewer.render();
        }, 100);
    }
}

// Function called when a step is successfully completed
function unlockStep(nextStep) {
    if (nextStep > highestReachedStep) {
        highestReachedStep = nextStep;
    }
    // Refresh UI to show the new button as clickable (Completed style)
    updateUI(currentStep); 
    
    // Auto-navigate to the next step for better flow
    // Note: We use setTimeout to allow any UI changes (like 'Success' messages) to appear first
    setTimeout(() => {
        navToStep(nextStep);
    }, 500);
}

// Set Docking Running State (called by run logic)
function setDockingState(isRunning) {
    isDockingRunning = isRunning;
    const btn = document.getElementById('run-docking-btn');
    if (btn) {
        if (isRunning) {
            btn.disabled = true;
            btn.innerText = "Running...";
        } else {
            btn.disabled = false;
            btn.innerText = "Start Docking Simulation";
        }
    }
}