document.getElementById("shipping-form").addEventListener("submit", function(event) {
    event.preventDefault();

    const width = parseFloat(document.getElementById("width").value);
    const length = parseFloat(document.getElementById("length").value);
    const height = parseFloat(document.getElementById("height").value);
    const weight = parseFloat(document.getElementById("weight").value);
    const postalCode = parseInt(document.getElementById("postal-code").value);

    if (isNaN(width) || isNaN(length) || isNaN(height) || isNaN(weight) || isNaN(postalCode)) {
        alert("Por favor, ingresa valores válidos.");
        return;
    }

    // Cálculo de volumen y peso volumétrico
    const volume = width * length * height; // cm³
    const volumetricWeight = volume / 5000;

    document.getElementById("volume").textContent = volume.toFixed(2);
    document.getElementById("volumetric-weight").textContent = volumetricWeight.toFixed(2);

    // Determinar tipo de tarifa según condiciones
    fetch("Condiciones.csv")
        .then(response => response.text())
        .then(data => {
            let lines = data.split("\n").map(line => line.split(","));
            let rateType = "Desconocido";

            for (let i = 1; i < lines.length; i++) {
                let [tarifa, medidas, pesoKg] = lines[i];

                let volumenLimite = parseFloat(medidas.replace("m³", "")) * 1000000; // Convertir a cm³
                let [minWeight, maxWeight] = pesoKg.split("-").map(Number);

                if (weight >= minWeight && weight <= maxWeight && volume <= volumenLimite) {
                    rateType = tarifa.trim();
                    break;
                }
            }

            document.getElementById("rate-type").textContent = rateType;

            // Buscar costo en Costos.csv considerando los rangos de códigos postales
            fetch("Costos.csv")
                .then(response => response.text())
                .then(data => {
                    let lines = data.split("\n").map(line => line.split(","));
                    let cost = "No disponible";
                    let state = "No identificado";

                    for (let i = 1; i < lines.length; i++) {
                        let [city, stateName, range, ...tariffs] = lines[i];
                        let [start, end] = range.split("–").map(Number); // Extraer rango de CP

                        if (postalCode >= start && postalCode <= end) {
                            state = stateName.trim();
                            let tariffIndex = tariffs.findIndex((t, idx) => idx === parseInt(rateType.replace("Tarifa ", "")));
                            if (tariffIndex !== -1) {
                                cost = tariffs[tariffIndex].replace("$", "").replace(",", "").trim();
                            }
                            break;
                        }
                    }

                    document.getElementById("state").textContent = state;
                    document.getElementById("cost").textContent = cost;
                });
        });
});

// Botón para limpiar los campos
document.getElementById("clear-btn").addEventListener("click", function() {
    document.getElementById("shipping-form").reset();
    document.getElementById("volume").textContent = "";
    document.getElementById("volumetric-weight").textContent = "";
    document.getElementById("rate-type").textContent = "";
    document.getElementById("state").textContent = "";
    document.getElementById("cost").textContent = "";
});