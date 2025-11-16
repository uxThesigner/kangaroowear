// --- INICIALIZAÇÃO (O CéreBRO) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // === NOVO: LÓGICA DO CARRINHO COMPARTILHADO (RECEBEDOR) ===
    // (Executa ANTES de carregar o carrinho local)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedCartData = urlParams.get('cart');

        if (sharedCartData) {
            // 1. Decodifica o Base64 para JSON (string)
            const jsonString = atob(sharedCartData);
            // 2. Converte o JSON (string) para um Array
            const parsedCart = JSON.parse(jsonString);
            
            if (Array.isArray(parsedCart)) {
                // 3. Salva o carrinho compartilhado como o carrinho ATUAL
                localStorage.setItem('kangarooCart', JSON.stringify(parsedCart));
                
                // 4. Limpa o cupom antigo (se houver), pois ele pode não se aplicar
                localStorage.removeItem('appliedCouponCode');
                
                // 5. Limpa a URL para que o recarregamento da página não
                //    busque o carrinho compartilhado novamente.
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    } catch (e) {
        console.error("Erro ao decodificar carrinho compartilhado:", e);
        // Se der erro (link quebrado, etc.), apenas ignora e carrega o carrinho local.
    }
    // =======================================================


    // Carrega o carrinho (agora ele pode carregar o compartilhado ou o local)
    loadCart();
    
    // Carrega os componentes (Header e Footer)
    // O setupHeaderLogic (incluindo updateCartCount) é chamado como callback
    loadComponent('header-placeholder', 'cabecalho.html', setupHeaderLogic);
    loadComponent('footer-placeholder', 'rodape.html'); 
    
    // --- LÓGICA ESPECIAL POR PÁGINA ---

    // Lógica da Página de Busca
    if (document.body.classList.contains('search-page') && typeof PRODUCTS !== 'undefined') {
        renderSearchPage();
        setupInternalBannerCarousel('internal-banner-carousel-busca');
    }

    // Lógica da Página do Carrinho
    if (document.body.classList.contains('cart-page') && typeof PRODUCTS !== 'undefined') {
        setupCartPage(); 
    }

    // Lógica da Página de Produto
    if (document.body.classList.contains('product-detail-page') && typeof PRODUCTS !== 'undefined') {
        setupProductPage();
    }
    
    // Lógica da Página de Pagamento
    if (document.body.classList.contains('checkout-page') && typeof PRODUCTS !== 'undefined') {
        setupPaymentPage();
    }
    
    // Lógica das Páginas de Afiliados/Parcerias
    if (document.body.classList.contains('afiliados-page')) {
        setupConstructionMarquee(`construction-marquee-content-afiliados`, "EM DESENVOLVIMENTO | FAÇA PARTE DO NOSSO TIME | NOVIDADES EM BREVE");
        setupPartnerContent('afiliados-slider');
    }
    if (document.body.classList.contains('parcerias-page')) {
        setupConstructionMarquee(`construction-marquee-content-parcerias`, "EM DESENVOLVIMENTO | FAÇA PARTE DO NOSSO TIME | NOVIDADES EM BREVE");
        setupPartnerContent('parcerias-slider');
    }
    
    // Lógica da Página Home (Slider de Parceiros)
    const homePartnerSlider = document.getElementById('partner-slider-container');
    if (homePartnerSlider) {
        setupPartnerContent('partner-slider-container');
    }

    // Lógica da Página LOVE
    if (document.body.classList.contains('love-page')) {
        
        if (typeof PRODUCTS !== 'undefined') {
            // Carrossel Lançamentos (Tags: 'love' e 'lancamento')
            setupProductSlider('love-product-slider', ['love', 'lancamento']);
            // Carrossel de Temas (Clicáveis)
            setupThemeCarouselActions();
        }
        
        // Banner rotativo
        setupInternalBannerCarousel('love-banner-carousel');
    }
});
