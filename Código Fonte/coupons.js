const COUPONS = [
    {
        code: 'KANGAR10',
        description: '10% OFF em toda a loja, exceto coleções exclusivas.',
        discount_percent: 0.10, // 10%
        valid_until: '2026-12-31', // Adicionado: Campo para simular validade futura
        is_per_customer: true
    },
    {
        code: 'NARUTO12',
        description: '12% OFF na coleção Animes.',
        discount_percent: 0.12, // 12%
        valid_until: '2025-06-30', // Adicionado: Campo para simular validade
        is_per_customer: true,
        target_collection: 'Animes' 
    },
    {
        code: 'PRIMEIRA',
        description: '20% OFF na primeira compra (para novos clientes).',
        discount_percent: 0.20,
        valid_until: '2025-12-31', 
        is_per_customer: true,
        is_new_customer_only: true
    }
];
