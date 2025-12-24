// viewer.js

var viewer = null;

window.onload = function () {
    viewer = $3Dmol.createViewer("viewer", {
        defaultcolors: $3Dmol.rasmolElementColors
    });
};

// Function to load the protein structure into the viewer
async function loadProteinStructure(filepath) {
    try {
        const response = await fetch(`/get_pdb?filepath=${encodeURIComponent(filepath)}`);
        if (!response.ok) {
            throw new Error("Failed to fetch PDB file from the server.");
        }
        const pdbText = await response.text();

        // Clear any existing models
        viewer.clear();

        // Load the PDB data into the viewer
        viewer.addModel(pdbText, "pdb");

        // Set display styles
        viewer.setStyle({}, { cartoon: { color: 'spectrum' } });

        // Zoom to fit the structure
        viewer.zoomTo();
        viewer.render();

        // --- NEW: Dynamic Coordinates Logic ---
        // Setup Hover Callback
        viewer.setHoverable({}, true, function(atom, viewer, event, container) {
            if(!atom) return;
            // Update the coordinate display text
            const coordsDiv = document.getElementById('mouse-coords');
            if(coordsDiv) {
                coordsDiv.innerText = `X: ${atom.x.toFixed(2)} Y: ${atom.y.toFixed(2)} Z: ${atom.z.toFixed(2)}`;
            }
        }, function(atom, viewer, event, container) {
            // Optional: clear on unhover if desired, or keep last known position
        });

        // Show the viewer
        document.getElementById('viewer').style.display = 'block';

    } catch (error) {
        console.error("Error loading protein structure:", error);
    }
}