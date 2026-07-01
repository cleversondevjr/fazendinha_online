// Standalone test for Game Logic (PvU 2021 style)

function simulateWater(slotIndex, currentWaterExpiresAt, quantityToAdd = 1) {
    const maxWater = (slotIndex >= 6) ? 4 : 2;
    const waterDurationMs = 2 * 3600000; // 2 horas cada água

    let currentWaterEnd = currentWaterExpiresAt ? new Date(currentWaterExpiresAt).getTime() : Date.now();
    if (currentWaterEnd < Date.now()) currentWaterEnd = Date.now();

    const newExpiresAt = new Date(currentWaterEnd + (quantityToAdd * waterDurationMs));

    // Limite é calculado a partir de "agora"
    const limitMs = Date.now() + (maxWater * waterDurationMs);
    const isOverLimit = newExpiresAt.getTime() > (limitMs + 1000); // 1s tolerance for execution delay

    return {
        newExpiresAt,
        isOverLimit,
        maxHours: maxWater * 2
    };
}

console.log("--- Iniciando Verificação de Lógica de Água (PvU 2021) ---");

const now = Date.now();

// Teste Slot 0 (Limite 2 gotas = 4h)
console.log("\nSlot 0 (Limite 2 gotas):");
let r1 = simulateWater(0, null);
console.log(`Adicionar 1ª gota: ${r1.newExpiresAt.toISOString()} (Passou do limite: ${r1.isOverLimit})`);

let r2 = simulateWater(0, r1.newExpiresAt);
console.log(`Adicionar 2ª gota: ${r2.newExpiresAt.toISOString()} (Passou do limite: ${r2.isOverLimit})`);

let r3 = simulateWater(0, r2.newExpiresAt);
console.log(`Adicionar 3ª gota: ${r3.newExpiresAt.toISOString()} (Passou do limite: ${r3.isOverLimit}) - ESPERADO: TRUE`);

// Teste Slot 6 (Limite 4 gotas = 8h)
console.log("\nSlot 6 (Limite 4 gotas):");
let s1 = simulateWater(6, null);
console.log(`Adicionar 1ª gota: ${s1.newExpiresAt.toISOString()} (Passou do limite: ${s1.isOverLimit})`);

let s4 = simulateWater(6, new Date(now + 3 * 2 * 3600000)); // já tem 3 gotas (6h)
console.log(`Adicionar 4ª gota: ${s4.newExpiresAt.toISOString()} (Passou do limite: ${s4.isOverLimit})`);

let s5 = simulateWater(6, s4.newExpiresAt);
console.log(`Adicionar 5ª gota: ${s5.newExpiresAt.toISOString()} (Passou do limite: ${s5.isOverLimit}) - ESPERADO: TRUE`);

console.log("\n--- Verificação Concluída ---");
