// Array para armazenar os itens do carrinho (persiste com localStorage)
let cartItems = [];

// Variável global para rastrear o cupom aplicado
let appliedCoupon = null;

// Número do WhatsApp da sua loja 
const WHATSAPP_NUMBER = '5592985979514'; 


// --- FUNÇÃO DE CONFIGURAÇÃO DE LÓGICA DO HEADER ---
function setupHeaderLogic() {
    setupScrolledHeader(); 
    setupMobileMenu(); 
    setupSearch(); 
    
    // CORREÇÃO CRÍTICA: Chama a atualização da contagem APÓS a injeção do Header.
    updateCartCount(); 

    // === MELHORIA UX: Sincroniza o carrinho entre abas ===
    window.addEventListener('storage', (event) => {
        // Se o carrinho ou o cupom for alterado em outra aba...
        if (event.key === 'kangarooCart' || event.key === 'appliedCouponCode') {
            // Recarrega os dados do localStorage
            loadCart(); 
            // Atualiza o contador de ícones
            updateCartCount();
            
            // Se o usuário estiver na página do carrinho, atualiza a UI
            if (document.body.classList.contains('cart-page')) {
                renderCartPage();
            }
            // Se o usuário estiver na página de checkout, atualiza a UI
            if (document.body.classList.contains('checkout-page')) {
                setupPaymentPage(); // Recarrega os dados do checkout
            }
        }
    });
    // =======================================================
}

// --- FUNÇÃO ADICIONADA: CARREGAMENTO DE COMPONENTES SIMPLES VIA JAVASCRIPT ---
function loadComponent(elementId, componentUrl, callback = null) {
    const componentElement = document.getElementById(elementId);
    if (!componentElement) return;

    fetch(componentUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro ao carregar componente: ${response.statusText}`);
            }
            return response.text();
        })
        .then(html => {
            componentElement.innerHTML = html;
            if (callback) { // Executa o callback após a injeção do HTML
                callback();
            }
        })
        .catch(error => {
            console.error(`Falha ao carregar ${componentUrl}:`, error);
            componentElement.innerHTML = `<p style="color: #CC0000; text-align: center; padding: 20px;">Componente indisponível. Recarregue a página.</p>`;
        });
}

// --- FUNÇÕES DE UTILIDADE E MANIPULAÇÃO DE DADOS ---

function saveCart() {
    localStorage.setItem('kangarooCart', JSON.stringify(cartItems));
    if (appliedCoupon) {
        localStorage.setItem('appliedCouponCode', appliedCoupon.code);
    } else {
        localStorage.removeItem('appliedCouponCode');
    }
}

function loadCart() { 
    const storedCart = localStorage.getItem('kangarooCart');
    if (storedCart) {
        cartItems = JSON.parse(storedCart);
    }
    
    // Tenta carregar um cupom salvo
    const storedCouponCode = localStorage.getItem('appliedCouponCode');
    if (storedCouponCode && typeof COUPONS !== 'undefined') {
        appliedCoupon = COUPONS.find(c => c.code === storedCouponCode);
    }
}

function addItemToCart(productId, color, size, quantity = 1) {
    // Garante que os produtos (PRODUCTS) estejam carregados
    if (typeof PRODUCTS === 'undefined') return; 
    
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    // Cria um identificador único para o item (Produto + Cor + Tamanho)
    const itemIdentifier = `${productId}-${color}-${size}`;
    const existingItem = cartItems.find(item => item.identifier === itemIdentifier);

    if (existingItem) {
        // Se já existe, apenas soma a quantidade
        existingItem.quantity += quantity;
    } else {
        // Se é novo, adiciona ao array
        cartItems.push({
            identifier: itemIdentifier,
            id: productId,
            name: product.name,
            image: product.image,
            price: product.price,
            color: color,
            size: size,
            quantity: quantity,
        });
    }

    saveCart();
    
    // Funções de UI
    updateCartCount(); 
    
    // Se estivermos na página do carrinho, atualiza a lista
    if (document.body.classList.contains('cart-page')) {
        renderCartPage();
    }
}

// --- NOVA FUNÇÃO (para Camisa Exclusiva) ---
/**
 * Adiciona um item customizado (Camisa Exclusiva) ao carrinho.
 * Como não é um produto do products.js, ele tem sua própria lógica.
 */
function addCustomItemToCart(itemData) {
    // Cria um identificador único baseado nos dados
    const itemIdentifier = `custom-${Date.now()}`;
    
    cartItems.push({
        identifier: itemIdentifier,
        id: 'custom-exclusive', // ID Fixo para itens customizados
        name: itemData.name, // Ex: "Camisa Exclusiva - Estilo Anime"
        image: itemData.image, // Imagem do estilo de traço
        price: itemData.price, // Preço total calculado
        color: itemData.color, // Cor da camisa
        size: itemData.size, // Tamanho da camisa
        quantity: 1,
        // (Opcional) Adiciona os detalhes para o checkout
        customDetails: itemData.description 
    });

    saveCart();
    updateCartCount();
}
// --- FIM DA NOVA FUNÇÃO ---


function removeItem(identifier) {
    cartItems = cartItems.filter(item => item.identifier !== identifier);
    saveCart();
    
    // Funções de UI
    updateCartCount();
    renderCartPage();
}

function updateCartItemQuantity(identifier, newQuantity) {
    const item = cartItems.find(item => item.identifier === identifier);
    if (item) {
        item.quantity = parseInt(newQuantity);
        if (item.quantity <= 0) {
            // Se a quantidade for 0 ou menos, remove o item
            removeItem(identifier);
        } else {
            saveCart();
            // Função de UI
            renderCartPage();
        }
    }
}

function calculateTotals() {
    const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    // Regra de Frete
    const SHIPPING_THRESHOLD = 250.00; 
    const SHIPPING_COST = 25.00; 
    
    const shipping = (subtotal >= SHIPPING_THRESHOLD) 
        ? 0.00
        : (subtotal > 0 ? SHIPPING_COST : 0.00); 

    // Cálculo de Desconto
    let discount = 0;
    if (appliedCoupon) {
        discount = subtotal * appliedCoupon.discount_percent;
    }

    const total = subtotal + shipping - discount;
    const installmentValue = total / 6;

    return {
        subtotal: subtotal,
        shipping: shipping,
        discount: discount,
        total: total,
        installments: installmentValue
    };
}


// --- LÓGICA DO CUPOM ---

function handleCouponInput() {
    const input = document.getElementById('cupom-input');
    const messageEl = document.getElementById('cupom-status-message'); 
    
    if (!input || !messageEl || typeof COUPONS === 'undefined') return;

    const code = input.value.toUpperCase().trim();

    if (!code) {
        // Se o campo estiver vazio, remove o cupom aplicado (se houver)
        if (appliedCoupon) {
            const removedCode = appliedCoupon.code;
            appliedCoupon = null;
            localStorage.removeItem('appliedCouponCode');
            messageEl.textContent = `Cupom ${removedCode} removido.`;
            messageEl.style.color = 'var(--color-primary)';
            updateCartSummary(); // Função de UI
        } else {
            messageEl.textContent = "Digite um código.";
            messageEl.style.color = 'var(--color-primary)';
        }
        return;
    }
    
    // AJUSTE: Lógica de Substituição de Cupom
    if (appliedCoupon) {
        appliedCoupon = null;
        localStorage.removeItem('appliedCouponCode');
    }
    
    const coupon = COUPONS.find(c => c.code === code);

    // Validação 1: Cupom existe?
    if (!coupon) {
        messageEl.textContent = "❌ Cupom inválido ou expirado.";
        messageEl.style.color = 'var(--color-highlight)';
        appliedCoupon = null;
        localStorage.removeItem('appliedCouponCode');
        updateCartSummary(); // Função de UI
        return;
    }
    
    // Validação 2: Cupom é para uma coleção específica?
    if (coupon.target_collection && cartItems.length > 0) {
        const hasTargetProduct = cartItems.some(item => {
            // Ignora itens customizados na validação de cupom
            if (item.id === 'custom-exclusive') return false; 
            
            const productData = PRODUCTS.find(p => p.id === item.id);
            return productData && productData.collection === coupon.target_collection;
        });
        
        if (!hasTargetProduct) {
             messageEl.textContent = `❌ Cupom ${code} requer um produto da coleção ${coupon.target_collection}.`;
             messageEl.style.color = 'var(--color-highlight)';
             appliedCoupon = null;
             localStorage.removeItem('appliedCouponCode');
             updateCartSummary(); // Função de UI
             return;
        }
    }
    
    // Sucesso! Aplica o cupom
    appliedCoupon = coupon;
    localStorage.setItem('appliedCouponCode', code);
    messageEl.textContent = `✅ Cupom ${code} aplicado! ${Math.round(coupon.discount_percent * 100)}% de desconto.`;
    messageEl.style.color = 'var(--color-accent)';
    updateCartSummary(); // Função de UI
}

// --- FUNÇÕES DE UTILIDADE DE UI ---

function formatPrice(priceValue) {
    if (typeof priceValue === 'string') {
        // Converte string (ex: 'R$ 89,90') para número
        priceValue = parseFloat(priceValue.replace('R$', '').replace('.', '').replace(',', '.').trim());
    }
    // Formata o número de volta para a string (R$ 89,90)
    return `R$ ${priceValue.toFixed(2).replace('.', ',')}`;
}

function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') ? urlParams.get('q').toLowerCase() : null;
}

// --- FUNÇÕES DE RENDERIZAÇÃO (GERAÇÃO DE HTML) ---

/**
 * Atualiza o contador de itens no ícone do carrinho no header.
 */
function updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) { 
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        cartCountElement.textContent = totalItems;
    }
}

/**
 * Cria os pequenos quadrados de amostra de cor para os cards.
 */
function createColorSwatches(colors) {
    let swatchesHTML = '';
    const colorMap = {
        'Preto': '#000000', 'Cinza': '#808080', 'Branco': '#FFFFFF',
        'Vermelho': '#FF0000', 'Azul': '#0000FF', 'Verde': '#008000',
        'Laranja': '#FFA500', 'Roxo': '#800080', 'Bege': '#F5F5DC', 'Rosa': '#FFC0CB'
    };
    for (const colorName of colors) {
        const cssColor = colorMap[colorName] || colorName.toLowerCase(); 
        swatchesHTML += `<span class="color-swatch" style="background-color: ${cssColor};" title="${colorName}"></span>`;
    }
    return swatchesHTML;
}

/**
 * Cria o HTML para um único card de produto.
 */
function renderProductCard(product) {
    const priceString = formatPrice(product.price);
    const colorSwatchesHTML = createColorSwatches(product.colors);
    const imagePath = product.image; // Caminho já vem correto de products.js

    return `
        <a href="produtos.html?id=${product.id}" class="product-card-link">
            <div class="product-card">
                <div class="product-image-container">
                    <img src="${imagePath}" alt="${product.name}" class="product-main-img" loading="lazy">
                </div>
                <div class.product-info">
                    <div class="product-meta">
                        <span class="rating"><i class="fas fa-star"></i> ${product.rating}</span>
                        <span class="reviews-count">${product.reviews} reviews</span>
                    </div>
                    <h3>${product.name}</h3>
                    <div class="price-box">
                        <span class="price-tag">por apenas</span>
                        <span class="current-price">${priceString}</span>
                    </div>
                    <span class="coupon-notice">use o cupom: <strong>${product.coupon}</strong></span>
                    <div class="color-swatches">
                        ${colorSwatchesHTML}
                    </div>
                </div>
            </div>
        </a>
    `;
}

/**
 * Cria o HTML para um único card de parceiro.
 */
function renderPartnerCard(partner) {
    return `
        <a href="${partner.link}" target="_blank" class="partner-card-link">
            <div class="partner-card">
                <div class="partner-image-container">
                    <img src="Imagens/Fotos Parceiros/${partner.image}" alt="${partner.name}" loading="lazy">
                </div>
                <div class="partner-info">
                    <h3>${partner.name}</h3>
                    <p class="partner-nickname">${partner.nickname}</p>
                </div>
            </div>
        </a>
    `;
}

/**
 * Renderiza a página de resultados de busca (busca.html).
 */
function renderSearchPage() {
    const resultsGridEl = document.getElementById('search-results');
    const searchTitleEl = document.getElementById('search-title');
    const query = getSearchQuery(); 

    if (!resultsGridEl || !searchTitleEl) return;
    if (typeof PRODUCTS === 'undefined') {
        console.error("products.js não foi carregado a tempo.");
        return;
    }

    if (!query) {
        searchTitleEl.textContent = 'O que você está procurando?';
        resultsGridEl.innerHTML = '<p class="search-no-results">Use a barra de busca acima para encontrar seus produtos favoritos!</p>';
        return;
    }

    const decodedQuery = decodeURIComponent(query);
    const results = searchProducts(decodedQuery); // Função de 'main.js'

    if (results.length > 0) {
        searchTitleEl.textContent = `Resultados para "${decodedQuery}" (${results.length} itens)`;
        let htmlContent = '';
        results.forEach(product => {
            htmlContent += renderProductCard(product); 
        });
        resultsGridEl.innerHTML = htmlContent;
    } else {
        searchTitleEl.textContent = `Nenhum resultado encontrado para "${decodedQuery}"`;
        resultsGridEl.innerHTML = `
            <p class="search-no-results">
                Sua busca não retornou resultados. <br>
                Tente simplificar o termo ou explorar nossas coleções no menu.
            </p>`;
    }
}

/**
 * Renderiza a lista de itens na página do carrinho (carrinho.html).
 */
function renderCartPage() {
    const cartBody = document.getElementById('cart-list-body');
    if (!cartBody) return;

    if (cartItems.length === 0) {
        cartBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; font-size: 1.1em; color: #555;">
                    Seu carrinho está vazio!
                </td>
            </tr>
        `;
    } else {
        let htmlContent = '';
        cartItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            // Usa a imagem do item (seja do product.js ou a customizada)
            const imagePath = item.image; 
            
            htmlContent += `
                <tr>
                    <td class="product-info-cell">
                        <img src="${imagePath}" alt="${item.name}" class="cart-product-img">
                        <span>${item.name}</span>
                    </td>
                    <td>${item.color}</td>
                    <td>${item.size}</td>
                    <td>
                        <input type="number" min="1" value="${item.quantity}" class="cart-quantity-input" 
                               data-identifier="${item.identifier}">
                    </td>
                    <td>${formatPrice(itemTotal)}</td>
                    <td>
                        <button class="btn-remove-item" data-identifier="${item.identifier}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        cartBody.innerHTML = htmlContent;
    }

    updateCartSummary(); 
    setupCartListeners(); 
}

/**
 * Atualiza o bloco de Resumo do Pedido (em carrinho.html e pagamento.html).
 */
function updateCartSummary() {
    const { subtotal, shipping, discount, total } = calculateTotals(); 
    
    const subtotalEl = document.getElementById('summary-subtotal');
    const shippingEl = document.getElementById('summary-shipping');
    const totalEl = document.getElementById('summary-total');
    const installmentsEl = document.querySelector('.installments-info');
    const checkoutBtn = document.getElementById('checkout-btn');
    const discountLine = document.getElementById('summary-discount-line');
    const discountEl = document.getElementById('summary-discount');
    const discountPercentEl = document.getElementById('discount-percent');
    
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    
    const shippingDisplay = (shipping === 0 && subtotal > 0) ? 'GRÁTIS' : formatPrice(shipping);
    if (shippingEl) shippingEl.textContent = shippingDisplay;
    
    if (discount > 0 && discountLine && discountEl && discountPercentEl) {
        discountLine.style.display = 'flex';
        discountEl.textContent = `- ${formatPrice(discount)}`;
        discountPercentEl.textContent = appliedCoupon ? `${Math.round(appliedCoupon.discount_percent * 100)}%` : '';
    } else if (discountLine) {
        discountLine.style.display = 'none';
    }
    
    if (totalEl) totalEl.textContent = formatPrice(total);
    
    if (installmentsEl) installmentsEl.textContent = `Em até 6x de ${formatPrice(total / 6)} sem juros.`;
    
    if (checkoutBtn) {
        checkoutBtn.disabled = total <= 0;
        checkoutBtn.textContent = total > 0 ? `FINALIZAR COMPRA` : 'CARRINHO VAZIO';
    }
}

/**
 * Renderiza a grade de produtos na seção de expansão da página Love.
 */
function renderThemeResults(container, products, themeName) {
    if (!container) return;
    
    container.innerHTML = ''; 
    let htmlContent = '';

    if (products.length === 0) {
        htmlContent = `
            <div class="container">
                <h2 class="love-results-title">Coleção Love: ${themeName}</h2>
                <div class="search-results-grid">
                    <p class="search-no-results">
                        Ops! Ainda não temos produtos para casais deste tema. <br>
                        Fique de olho, novidades chegam em breve!
                    </p>
                </div>
            </div>
        `;
    } else {
        const productCardsHTML = products.map(renderProductCard).join('');
        const titleHTML = `<div class="container"><h2 class="love-results-title">Coleção Love: ${themeName}</h2>`;
        htmlContent = `${titleHTML}<div class="search-results-grid">${productCardsHTML}</div></div>`;
    }
    
    container.innerHTML = htmlContent;
}

// --- FUNÇÕES DE BUSCA E FILTRO ---

function searchProducts(query) {
    if (!query || typeof PRODUCTS === 'undefined') {
        return [];
    }
    
    const lowerCaseQuery = query.toLowerCase();
    
    return PRODUCTS.filter(product => {
        const productName = product.name.toLowerCase();
        const productTags = product.tags.join(' ').toLowerCase();
        
        return productName.includes(lowerCaseQuery) || productTags.includes(lowerCaseQuery);
    });
}

/**
 * Encontra produtos que tenham TODAS as tags especificadas.
 */
function findProductsByTags(requiredTags = []) {
    if (typeof PRODUCTS === 'undefined' || requiredTags.length === 0) {
        return [];
    }
    
    const lowerCaseTags = requiredTags.map(tag => tag.toLowerCase());
    
    return PRODUCTS.filter(product => {
        const productTags = product.tags.map(t => t.toLowerCase());
        return lowerCaseTags.every(tag => productTags.includes(tag));
    });
}


// --- FUNÇÕES DE SETUP (Configuradores de Página) ---

/**
 * Adiciona os listeners de clique para remoção e mudança de quantidade no carrinho.
 */
function setupCartListeners() {
    document.querySelectorAll('.btn-remove-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const identifier = e.currentTarget.dataset.identifier;
            removeItem(identifier); // Função de 'cart.js'
        });
    });

    document.querySelectorAll('.cart-quantity-input').forEach(input => {
        // Altera para 'input' para atualizar em tempo real (caso o usuário digite)
        input.addEventListener('input', (e) => { 
            const identifier = e.currentTarget.dataset.identifier;
            updateCartItemQuantity(identifier, e.target.value); // Função de 'cart.js'
        });
    });
}

/**
 * Configura o botão "Finalizar Compra" na página do carrinho.
 */
function setupCheckoutButton() {
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cartItems.length > 0) {
                saveCart();
                window.location.href = 'pagamento.html';
            } else {
                alert('Seu carrinho está vazio!'); // TODO: Substituir por modal
            }
        });
    }
}

/**
 * Preenche a página de detalhes do produto (produtos.html) com dados.
 */
function setupProductPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId || typeof PRODUCTS === 'undefined') {
        window.location.href = 'index.html'; 
        return;
    }
    
    const product = PRODUCTS.find(p => p.id === productId);
    
    if (!product) {
        window.location.href = 'index.html'; 
        return;
    }

    const imagePath = product.image; 

    // === CORREÇÃO SEO (Ajuste 3) ===
    document.title = `${product.name} | KANGAROO WEAR`;
    
    const mainImage = document.getElementById('main-product-image');
    if (mainImage) {
        mainImage.alt = product.name;
    }
    
    const metaDescription = document.getElementById('product-description');
    if (metaDescription) {
        metaDescription.setAttribute('content', `Compre sua ${product.name} em ${product.material}. Qualidade premium em até 6x sem juros.`);
    }
    // ===============================

    
    document.getElementById('main-product-image').src = imagePath;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-rating').innerHTML = `<i class="fas fa-star"></i> ${product.rating}`;
    document.getElementById('product-reviews').textContent = `(${product.reviews} reviews)`;
    document.getElementById('product-price').textContent = formatPrice(product.price);
    document.getElementById('product-material').textContent = product.material;

    const thumbnailGallery = document.getElementById('thumbnail-gallery');
    thumbnailGallery.innerHTML = ''; 
    for (let i = 0; i < 5; i++) {
        thumbnailGallery.innerHTML += `
            <div class="thumbnail-item ${i === 0 ? 'active' : ''}">
                <img src="${imagePath}" alt="Thumbnail ${i + 1}">
            </div>
        `;
    }

    const colorSelect = document.getElementById('color-select');
    colorSelect.innerHTML = ''; 
    product.colors.forEach(color => {
        colorSelect.innerHTML += `<option value="${color.toLowerCase()}">${color}</option>`;
    });

    const sizeSelect = document.getElementById('size-select');
    sizeSelect.innerHTML = ''; 
    product.sizes.forEach(size => {
        sizeSelect.innerHTML += `<option value="${size}">${size}</option>`;
    });

    const form = document.getElementById('add-to-cart-form');
    const messageEl = document.getElementById('add-to-cart-message');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const selectedColor = document.getElementById('color-select').value;
        const selectedSize = document.getElementById('size-select').value;
        const quantity = parseInt(document.getElementById('quantity-input').value);
        
        addItemToCart(product.id, selectedColor, selectedSize, quantity); // Função de 'cart.js'

        messageEl.textContent = 'Adicionado ao carrinho! 🎉';
        setTimeout(() => {
            messageEl.textContent = '';
        }, 2000);
    });

    const relatedProducts = PRODUCTS.filter(p => p.collection === product.collection && p.id !== product.id);
    const relatedSlider = document.getElementById('related-products-slider');
    
    if (relatedSlider && relatedProducts.length > 0) {
        let htmlContent = '';
        relatedProducts.forEach(relatedProduct => {
            htmlContent += renderProductCard(relatedProduct); 
        });
        relatedSlider.innerHTML = htmlContent;
    } else if (relatedSlider) {
        const relatedSection = document.querySelector('.related-products-section');
        if (relatedSection) relatedSection.style.display = 'none';
    }
    
    setupInternalBannerCarousel('internal-banner-carousel-produto'); 
}

/**
 * Gera o link de pedido para o WhatsApp com todos os dados.
 */
function generateWhatsAppOrderLink(formData) {
    const totals = calculateTotals(); // Função de 'cart.js'
    
    const normalize = (str) => String(str).toUpperCase().replace(/\s/g, '');
    
    const isPayerSameAsClient = 
        normalize(formData.nome_cliente) === normalize(formData.nome_pagador) && 
        normalize(formData.cpf_cliente) === normalize(formData.cpf_pagador);
    
    let clientBlock = `Sou: ${formData.nome_cliente}%0A`;
    clientBlock += `CPF/CNPJ: ${formData.cpf_cliente}%0A`;
    
    let pagadorBlock = '';
    if (!isPayerSameAsClient) {
        pagadorBlock = `O(a) pagador(a) é:%0A`;
        pagadorBlock += `Nome do(a) Pagador: ${formData.nome_pagador}%0A`;
        pagadorBlock += `CPF/CNPJ: ${formData.cpf_pagador}%0A`;
    }
    
    let cartBlock = `Em meu Kangaroo Cart, tem:%0A`;
    cartItems.forEach((item) => {
        // Adiciona detalhes extras se for um item customizado
        if (item.id === 'custom-exclusive') {
            cartBlock += `* ${item.name} | Qtd: ${item.quantity} | Tam: ${item.size} | Cor: ${item.color}%0A`;
            cartBlock += `   -> (Detalhes: ${item.customDetails})%0A`;
        } else {
            cartBlock += `* ${item.name} | Qtd: ${item.quantity} | Tam: ${item.size} | Cor: ${item.color}%0A`;
        }
    });
    
    let totalsBlock = `Cupom Utilizado: ${appliedCoupon ? appliedCoupon.code : 'Nenhum'}%0A`;
    totalsBlock += `Valor do Frete: ${totals.shipping === 0 ? 'GRÁTIS' : formatPrice(totals.shipping)}%0A`;
    totalsBlock += `Valor do pedido: ${formatPrice(totals.total)}%0A`;
    
    let addressBlock = `Dados de entrega%0A`;
    addressBlock += `Rua: ${formData.rua}%0A`;
    addressBlock += `Nº: ${formData.numero}%0A`;
    addressBlock += `Bairro: ${formData.bairro}%0A`;
    addressBlock += `Cidade: ${formData.cidade}%0A`;
    addressBlock += `Estado: ${formData.estado}%0A`;
    addressBlock += `CEP: ${formData.cep}%0A`;
    
    let message = `Olá, Kangaroo!%0A%0A`;
    message += clientBlock;
    message += '--------------------------------%0A';
    if (pagadorBlock) { 
        message += pagadorBlock;
        message += '--------------------------------%0A';
    }
    message += cartBlock;
    message += '--------------------------------%0A';
    message += totalsBlock;
    message += '--------------------------------%0A';
    message += addressBlock;
    
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}


/**
 * Configura os listeners e renderiza os itens na página de pagamento (pagamento.html).
 */
function setupPaymentPage() {
    
    // Função interna para renderizar o resumo
    function renderSummaryItems() {
        const itemsContainer = document.getElementById('checkout-summary-items');
        if (!itemsContainer) return;
        
        let itemsHTML = '';
        cartItems.forEach(item => {
            itemsHTML += `
                <div class="summary-item-line">
                    <span>${item.name} (${item.size}, ${item.color}) x${item.quantity}</span>
                    <span>${formatPrice(item.price * item.quantity)}</span>
                </div>
            `;
        });
        itemsContainer.innerHTML = itemsHTML;
        
        const totals = calculateTotals();
        document.getElementById('co_subtotal').textContent = formatPrice(totals.subtotal);
        document.getElementById('co_shipping').textContent = (totals.shipping === 0 && totals.subtotal > 0) ? 'GRÁTIS' : formatPrice(totals.shipping);
        document.getElementById('co_total').textContent = formatPrice(totals.total);
        
        const discountLine = document.getElementById('co_discount_line');
        if (totals.discount > 0 && discountLine) {
            discountLine.style.display = 'flex';
            document.getElementById('co_discount').textContent = `- ${formatPrice(totals.discount)}`;
        } else {
            if (discountLine) discountLine.style.display = 'none';
        }
    }
    
    // Listener para o checkbox "Mesmos dados"
    const payerCheckbox = document.getElementById('mesmos-dados-check');
    if (payerCheckbox) {
        payerCheckbox.addEventListener('change', function() {
            document.getElementById('pagador-nome').value = this.checked ? document.getElementById('nome-completo').value : '';
            document.getElementById('pagador-cpf').value = this.checked ? document.getElementById('cpf-cnpj').value : '';
        });
    }

    // Listeners para o Modal de Cancelamento
    const cancelBtn = document.getElementById('cancel-order-btn');
    const modal = document.getElementById('cancel-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalConfirmCancelBtn = document.getElementById('modal-confirm-cancel');

    if (cancelBtn && modal) {
        cancelBtn.addEventListener('click', (e) => {
             e.preventDefault(); 
             modal.style.display = 'flex';
        });
    }
    if (modalCloseBtn && modal) {
        modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
    }
    if (modalConfirmCancelBtn) {
        modalConfirmCancelBtn.addEventListener('click', () => {
            cartItems = [];
            saveCart();
            window.location.href = 'index.html'; 
        });
    }
    
    // Listener do formulário de envio
    const contactForm = document.getElementById('contact-info-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Coleta os dados do formulário
            const formData = {
                nome_cliente: document.getElementById('nome-completo').value,
                cpf_cliente: document.getElementById('cpf-cnpj').value,
                data_nascimento: document.getElementById('data-nascimento').value,
                rua: document.getElementById('rua').value,
                numero: document.getElementById('numero').value,
                bairro: document.getElementById('bairro').value,
                cidade: document.getElementById('cidade').value,
                estado: document.getElementById('estado').value,
                cep: document.getElementById('cep').value,
                nome_pagador: document.getElementById('pagador-nome').value,
                cpf_pagador: document.getElementById('pagador-cpf').value,
            };
            
            const whatsappUrl = generateWhatsAppOrderLink(formData);
            window.open(whatsappUrl, '_blank'); // Abre o WhatsApp em nova aba

            // === CORREÇÃO CRÍTICA (Já aplicada) ===
            // As linhas abaixo, que limpavam o carrinho, foram REMOVIDAS.
        });
    }

    // Renderiza o resumo ao carregar a página
    renderSummaryItems();
}


// --- FUNÇÕES DE SETUP (Componentes e Utilitários) ---

/**
 * Inicia um carrossel de banner simples (fade-in/fade-out).
 */
function setupInternalBannerCarousel(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const items = carousel.querySelectorAll('.internal-banner-item');
    if (items.length <= 1) return;

    let currentIndex = 0;
    const rotationTime = 4000; // 4 segundos

    setInterval(() => {
        const nextIndex = (currentIndex + 1) % items.length;

        items[currentIndex].classList.remove('active');
        items[nextIndex].classList.add('active');

        currentIndex = nextIndex;

    }, rotationTime);
}

/**
 * Preenche e anima a faixa (marquee) de "Em Construção".
 */
function setupConstructionMarquee(elementId, message) {
    const marqueeEl = document.getElementById(elementId);
    if (!marqueeEl) return;
    
    const fullMessage = `${message} | ${message}`;
    marqueeEl.innerHTML = `<span>${fullMessage}</span><span>${fullMessage}</span>`;
}

/**
 * Renderiza o carrossel de parceiros.
 */
function setupPartnerContent(sliderId) {
    const targetSlider = document.getElementById(sliderId);
    
    if (!targetSlider || typeof PARTNERS === 'undefined') {
        console.warn(`Slider ${sliderId} ou dados de PARTNERS não encontrados.`);
        return;
    }

    const htmlContent = PARTNERS.map(renderPartnerCard).join(''); 

    targetSlider.innerHTML = htmlContent;
    
    // Adiciona um leve delay para garantir que o HTML foi renderizado
    setTimeout(() => {
        scrollSlider(sliderId, 0);
    }, 100); 
}

/**
 * Renderiza um carrossel de produtos filtrados por tags.
 */
function setupProductSlider(sliderId, requiredTags = []) {
    const targetSlider = document.getElementById(sliderId);
    
    if (!targetSlider || typeof PRODUCTS === 'undefined') {
        console.warn(`Slider ${sliderId} ou dados de PRODUCTS não encontrados.`);
        return;
    }

    const filteredProducts = findProductsByTags(requiredTags);

    if (filteredProducts.length === 0) {
        targetSlider.innerHTML = `<p style="color: #555; text-align: center; padding: 0 20px;">Nenhum lançamento encontrado para esta coleção no momento.</p>`;
        return;
    }

    const htmlContent = filteredProducts.map(renderProductCard).join('');
    targetSlider.innerHTML = htmlContent;

    setTimeout(() => {
        scrollSlider(sliderId, 0);
    }, 100);
}

/**
 * Adiciona os listeners de clique nos cards de tema (página Love).
 */
function setupThemeCarouselActions() {
    const themeLinks = document.querySelectorAll('#theme-carousel-slider .theme-card-link');
    const resultsContainer = document.getElementById('love-theme-results');
    
    if (!themeLinks.length || !resultsContainer) return;

    let activeTheme = null; 

    themeLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const theme = link.dataset.theme;
            if (!theme) return;
            
            const themeName = link.querySelector('h3').textContent;
            themeLinks.forEach(l => l.classList.remove('active-theme'));

            if (activeTheme === theme) {
                resultsContainer.classList.remove('visible');
                activeTheme = null;
            } else {
                const requiredTags = ['love', theme];
                const products = findProductsByTags(requiredTags);
                
                renderThemeResults(resultsContainer, products, themeName);
                
                resultsContainer.classList.add('visible');
                link.classList.add('active-theme'); 
                activeTheme = theme;
                
                const cards = resultsContainer.querySelectorAll('.product-card-link');
                cards.forEach((card, index) => {
                    setTimeout(() => {
                        card.classList.add('in'); 
                    }, index * 100); 
                });
                
                setTimeout(() => {
                    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300); 
            }
        });

        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                link.click(); 
            }
        });
    });
}

/**
 * Configura o menu mobile (abrir/fechar/dropdowns).
 */
function setupMobileMenu() { 
    const menuToggle = document.querySelector('.header .menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu'); 
    const closeMenu = document.querySelector('.mobile-menu .close-menu');
    const mobileDropdownToggles = document.querySelectorAll('.mobile-menu .mobile-dropdown-toggle');

    if (!menuToggle || !mobileMenu || !closeMenu) return;

    const openFn = () => {
        mobileMenu.classList.add('open');
        document.body.style.overflow = 'hidden'; 
    };
    menuToggle.addEventListener('click', openFn);

    const closeFn = () => {
        mobileMenu.classList.remove('open');
        document.body.style.overflow = 'auto';
    };

    closeMenu.addEventListener('click', closeFn);
    
    mobileDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const dropdown = toggle.nextElementSibling;
            if (dropdown && dropdown.classList.contains('mobile-dropdown')) {
                dropdown.classList.toggle('active');
            }
        });
    });
}

/**
 * Adiciona o efeito de "scrolled" ao header.
 */
function setupScrolledHeader() { 
    const header = document.querySelector('.header');
    if (!header) {
        return; 
    }
    const scrollThreshold = 50; 
    function toggleScrolledClass() {
        if (window.scrollY > scrollThreshold) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    window.addEventListener('scroll', toggleScrolledClass);
    toggleScrolledClass(); 
}

/**
 * Adiciona o listener de 'Enter' na barra de busca.
 */
function setupSearch() { 
    const searchInput = document.querySelector('.header .search-input'); 
    if (!searchInput) return;

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim() !== '') {
            e.preventDefault(); 
            window.location.href = `busca.html?q=${encodeURIComponent(searchInput.value.trim())}`;
        }
    });
}

/**
 * Configura os listeners da página do carrinho (carrinho.html).
 */
function setupCartPage() {
    if (document.body.classList.contains('cart-page')) {
        renderCartPage();
        setupCheckoutButton(); 
        
        const cupomBtn = document.getElementById('cupom-btn');
        if (cupomBtn) {
            cupomBtn.addEventListener('click', handleCouponInput);
        }

        // === NOVO: Chama o setup do botão compartilhar ===
        setupShareCartButton();
        // =============================================
    }
}

/**
 * Função de scroll horizontal para os carrosséis.
 */
function scrollSlider(sliderId, direction) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    const firstCard = slider.querySelector('a, div[role="button"]'); 
    if (!firstCard) return;

    const cardStyle = window.getComputedStyle(firstCard);
    const cardWidth = firstCard.offsetWidth;
    const cardMarginRight = parseInt(cardStyle.marginRight, 10);
    
    const scrollAmount = (cardWidth + cardMarginRight) * direction; 

    slider.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
}


// === NOVA FUNÇÃO: Copiar para Área de Transferência ===
/**
 * Copia um texto para a área de transferência do usuário.
 * @param {string} text - O texto a ser copiado.
 */
function copyToClipboard(text) {
    // Cria um textarea temporário
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Adiciona a classe para torná-lo invisível (de base.css)
    textArea.classList.add('clipboard-helper');
    document.body.appendChild(textArea);
    
    // Seleciona e copia o texto
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Falha ao copiar texto: ', err);
    }
    
    // Remove o textarea temporário
    document.body.removeChild(textArea);
}
// =================================================


// === NOVA FUNÇÃO: Configurar Botão de Compartilhar ===
/**
 * Adiciona o listener de clique ao botão "Compartilhar Carrinho".
 */
function setupShareCartButton() {
    const shareBtn = document.getElementById('share-cart-btn');
    const successMsg = document.getElementById('share-cart-success');
    if (!shareBtn || !successMsg) return;

    shareBtn.addEventListener('click', (e) => {
        e.preventDefault();

        if (cartItems.length === 0) {
            // Se o carrinho estiver vazio, avisa
            shareBtn.style.display = 'none';
            successMsg.textContent = 'Carrinho vazio!';
            successMsg.style.display = 'inline';

            setTimeout(() => {
                shareBtn.style.display = 'inline';
                successMsg.style.display = 'none';
            }, 2000);
            return;
        }

        // 1. Converte o carrinho (array) para JSON (string)
        const jsonString = JSON.stringify(cartItems);
        // 2. Codifica a string JSON para Base64 (para ser segura na URL)
        const base64String = btoa(jsonString);

        // 3. Monta a URL (caminho atual + ?cart=DADOS)
        const shareUrl = `${window.location.origin}${window.location.pathname}?cart=${base64String}`;
        
        // 4. Copia para a área de transferência
        copyToClipboard(shareUrl);

        // 5. Mostra a mensagem de sucesso
        shareBtn.style.display = 'none';
        successMsg.textContent = 'Link copiado!';
        successMsg.style.display = 'inline';

        // 6. Reseta o botão após 2 segundos
        setTimeout(() => {
            shareBtn.style.display = 'inline';
            successMsg.style.display = 'none';
        }, 2000);
    });
}
// ===================================================


// === NOVA FUNÇÃO (Ajuste 8): SETUP DA PÁGINA EXCLUSIVAS (ASSISTENTE) ===
/**
 * Configura o assistente interativo da página exclusivas.html
 */
function setupExclusivasPage() {
    
    // --- Elementos Globais da Página ---
    const landingSection = document.getElementById('landing-section');
    const wizardSection = document.getElementById('wizard-section');
    const startBtn = document.getElementById('start-wizard-btn');
    
    if (!landingSection || !wizardSection || !startBtn) {
        // Se os elementos principais não existirem, não faz nada.
        // Carrega o carrossel de "trabalhos" (placeholder)
        setupPartnerContent('exclusivas-slider');
        return;
    }
    
    // --- Elementos do Assistente ---
    const wizardTitle = document.getElementById('wizard-title');
    const wizardBody = document.getElementById('wizard-step-body');
    const wizardNav = document.getElementById('wizard-navigation');
    const wizardSummary = document.getElementById('wizard-price-summary');
    const kangarooImg = document.getElementById('kangaroo-image');
    
    // --- Regras de Preço ---
    const PRECOS = {
        ARTE_UNICA: 120.00, // Ajuste 7: Preço base da arte
        ALGODAO: {
            padrao: 45.00,
            premium: 65.00
        },
        TAMANHO: {
            PP: 0.00,
            P: 0.00,
            M: 10.00,
            G: 15.00,
            GG: 18.00,
            XG: 25.00,
            XXG: 50.00
        },
        POR_COR: 8.00
    };
    
    // --- Objeto para guardar os dados do assistente ---
    let wizardData = {
        step: 0,
        description: "",
        referenceFile: null,
        material: "padrao", // 'padrao' ou 'premium'
        tamanho: "M",
        cor: "Preto",
        numCores: 1
    };
    
    // --- Definições das Etapas ---
    const STEPS = [
        "welcome", 
        "description", 
        "reference", 
        "material", 
        "size",
        "color",
        "final"
    ];
    
    /**
     * Troca a imagem do canguru com uma animação
     */
    function setKangaroo(imageName) {
        kangarooImg.style.transform = 'scale(0.95)';
        kangarooImg.style.opacity = '0.7';
        
        setTimeout(() => {
            kangarooImg.src = `Imagens/Kangaroo/${imageName}.png`;
            kangarooImg.style.transform = 'scale(1)';
            kangarooImg.style.opacity = '1';
        }, 200); // 200ms para a transição
    }
    
    /**
     * Rola para o topo do assistente (útil em celulares)
     */
    function scrollTop() {
        wizardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Atualiza o Resumo de Preços
     */
    function updatePriceSummary() {
        const precoArte = PRECOS.ARTE_UNICA;
        const precoAlgodao = PRECOS.ALGODAO[wizardData.material];
        const precoTamanho = PRECOS.TAMANHO[wizardData.tamanho];
        const precoCores = wizardData.numCores * PRECOS.POR_COR;
        const total = precoArte + precoAlgodao + precoTamanho + precoCores;

        document.getElementById('price-arte').textContent = formatPrice(precoArte);
        document.getElementById('price-algodao').textContent = formatPrice(precoAlgodao);
        document.getElementById('price-tamanho').textContent = formatPrice(precoTamanho);
        document.getElementById('price-cores').textContent = formatPrice(precoCores);
        document.getElementById('price-total').textContent = formatPrice(total);
        
        return total; // Retorna o total para o carrinho
    }

    /**
     * Função Mestra: Renderiza a etapa atual
     */
    function renderStep(stepIndex) {
        wizardData.step = stepIndex;
        const stepName = STEPS[stepIndex];
        
        wizardBody.innerHTML = ''; // Limpa o conteúdo anterior
        wizardNav.innerHTML = '';  // Limpa a navegação anterior
        wizardSummary.style.display = 'none'; // Esconde o resumo por padrão
        
        let navHTML = '';
        
        // Botão "Voltar" (não existe na primeira etapa)
        if (stepIndex > 0) {
            navHTML += `<button id="wizard-back-btn" class="btn btn-secondary wizard-btn-back">← Voltar</button>`;
        } else {
            navHTML += `<div></div>`; // Espaçador
        }
        
        // Lógica de cada etapa
        switch(stepName) {
            
            // --- ETAPA 0: BOAS-VINDAS ---
            case "welcome":
                setKangaroo('exkangaroo1');
                wizardTitle.textContent = "Vamos criar sua camisa exclusiva!";
                wizardBody.innerHTML = `
                    <p>Este é um processo de criação conjunta! Você nos diz sua ideia, e nossos artistas a transformarão em uma estampa única.</p>
                    <p>O processo leva alguns minutos e, ao final, você verá o orçamento completo. Lembre-se que o prazo de fabricação desta peça é de <strong>4 a 10 dias úteis</strong>.</p>
                    <p>Vamos começar?</p>
                `;
                navHTML += `
                    <div style="display: flex; gap: 10px;">
                        <button id="wizard-cancel-btn" class="btn btn-secondary">Não, obrigado</button>
                        <button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Concordo, vamos lá!</button>
                    </div>
                `;
                break;
                
            // --- ETAPA 1: DESCRIÇÃO ---
            case "description":
                setKangaroo('exkangaroo2');
                wizardTitle.textContent = "Como quer sua estampa?";
                wizardBody.innerHTML = `
                    <p>Me diga de forma detalhada, especificando cenário, personagens, cores, posturas e afins.</p>
                    <textarea id="wizard-desc-input" class="wizard-textarea" placeholder="Ex: Quero meu gato, o 'Frajola', com óculos escuros e uma jaqueta de couro...">${wizardData.description}</textarea>
                `;
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
            
            // --- ETAPA 2: REFERÊNCIA ---
            case "reference":
                setKangaroo('exkangaroo3');
                wizardTitle.textContent = "Você tem alguma referência?";
                wizardBody.innerHTML = `
                    <p>Envie uma ou mais imagens que ajudem nossos artistas a entender sua ideia (opcional).</p>
                    <input type="file" id="wizard-ref-input" class="wizard-upload" multiple>
                `;
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
                
            // --- ETAPA 3: MATERIAL ---
            case "material":
                setKangaroo('exkangaroo4');
                wizardTitle.textContent = "Qual material você prefere?";
                wizardBody.innerHTML = `
                    <div class="wizard-options-grid">
                        <button class="wizard-btn-option ${wizardData.material === 'padrao' ? 'selected' : ''}" data-value="padrao">
                            <h4>Algodão Padrão</h4>
                            <p>(R$ 45,00)</p>
                        </button>
                        <button class="wizard-btn-option ${wizardData.material === 'premium' ? 'selected' : ''}" data-value="premium">
                            <h4>Algodão Premium</h4>
                            <p>(R$ 65,00)</p>
                        </button>
                    </div>
                `;
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
                
            // --- ETAPA 4: TAMANHO ---
            case "size":
                setKangaroo('exkangaroo5');
                wizardTitle.textContent = "Qual o tamanho da camisa?";
                wizardBody.innerHTML = `
                    <p>O preço varia para tamanhos maiores.</p>
                    <div class="wizard-balloons-group" id="wizard-size-group">
                        <button class="wizard-btn-balloon" data-value="PP">PP</button>
                        <button class="wizard-btn-balloon" data-value="P">P</button>
                        <button class="wizard-btn-balloon" data-value="M">M</button>
                        <button class="wizard-btn-balloon" data-value="G">G</button>
                        <button class="wizard-btn-balloon" data-value="GG">GG</button>
                        <button class="wizard-btn-balloon" data-value="XG">XG</button>
                        <button class="wizard-btn-balloon" data-value="XXG">XXG</button>
                    </div>
                `;
                // Marca o botão 'selected'
                wizardBody.querySelector(`.wizard-btn-balloon[data-value="${wizardData.tamanho}"]`).classList.add('selected');
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
            
            // --- ETAPA 5: COR ---
            case "color":
                setKangaroo('exkangaroo5'); // Mesma imagem
                wizardTitle.textContent = "E a cor da camisa?";
                wizardBody.innerHTML = `
                    <p>Escolha a cor de fundo para sua arte.</p>
                    <div class="wizard-balloons-group" id="wizard-color-group">
                        <button class="wizard-btn-balloon" data-value="Preto">Preto</button>
                        <button class="wizard-btn-balloon" data-value="Branco">Branco</button>
                        <button class="wizard-btn-balloon" data-value="Cinza">Cinza</button>
                    </div>
                `;
                // Marca o botão 'selected'
                wizardBody.querySelector(`.wizard-btn-balloon[data-value="${wizardData.cor}"]`).classList.add('selected');
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
                
            // --- ETAPA 6: CORES DA ARTE / FINAL ---
            case "final":
                setKangaroo('exkangaroo4'); // Mesma imagem
                wizardTitle.textContent = "Estamos quase acabando!";
                wizardBody.innerHTML = `
                    <p>Quantas cores você estima que sua arte terá? (Cada cor adiciona R$ 8,00).</p>
                    <input type="number" id="wizard-cores-input" class="wizard-input-number" value="${wizardData.numCores}" min="1">
                `;
                // Mostra o resumo do preço
                wizardSummary.style.display = 'block';
                updatePriceSummary();
                
                navHTML += `<button id="wizard-add-btn" class="btn btn-primary wizard-btn-add-cart"><i class="fas fa-shopping-cart"></i> Adicionar ao Carrinho</button>`;
                break;
        }
        
        wizardNav.innerHTML = navHTML;
        scrollTop();
    }
    
    /**
     * Delegação de eventos para o corpo do assistente
     * (Otimizado para não adicionar/remover listeners toda hora)
     */
    wizardBody.addEventListener('click', (e) => {
        // --- Lógica dos botões de Material (Etapa 3) ---
        if (e.target.closest('.wizard-btn-option')) {
            const btn = e.target.closest('.wizard-btn-option');
            wizardData.material = btn.dataset.value;
            // Atualiza visual
            wizardBody.querySelectorAll('.wizard-btn-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        }
        
        // --- Lógica dos botões de Tamanho (Etapa 4) ---
        if (e.target.closest('#wizard-size-group .wizard-btn-balloon')) {
            const btn = e.target.closest('#wizard-size-group .wizard-btn-balloon');
            wizardData.tamanho = btn.dataset.value;
            // Atualiza visual
            wizardBody.querySelectorAll('#wizard-size-group .wizard-btn-balloon').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        }
        
        // --- Lógica dos botões de Cor (Etapa 5) ---
        if (e.target.closest('#wizard-color-group .wizard-btn-balloon')) {
            const btn = e.target.closest('#wizard-color-group .wizard-btn-balloon');
            wizardData.cor = btn.dataset.value;
            // Atualiza visual
            wizardBody.querySelectorAll('#wizard-color-group .wizard-btn-balloon').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        }
    });

    /**
     * Atualiza o número de cores e o preço na etapa final
     */
    wizardBody.addEventListener('input', (e) {
        if (e.target.id === 'wizard-cores-input') {
            wizardData.numCores = parseInt(e.target.value) || 1;
            updatePriceSummary();
        }
    });

    /**
     * Delegação de eventos para a Navegação do assistente
     */
    wizardNav.addEventListener('click', (e) => {
        // --- Botão "Continuar" ---
        if (e.target.id === 'wizard-next-btn') {
            // Salva os dados da etapa atual antes de avançar
            if (STEPS[wizardData.step] === 'description') {
                const desc = document.getElementById('wizard-desc-input').value;
                if (!desc) {
                    alert('Por favor, descreva sua ideia para continuarmos.');
                    return;
                }
                wizardData.description = desc;
            }
            if (STEPS[wizardData.step] === 'reference') {
                const fileInput = document.getElementById('wizard-ref-input');
                wizardData.referenceFile = fileInput.files.length > 0 ? fileInput.files[0].name : null;
            }
            
            renderStep(wizardData.step + 1); // Avança
        }
        
        // --- Botão "Voltar" ---
        if (e.target.id === 'wizard-back-btn') {
            renderStep(wizardData.step - 1); // Volta
        }
        
        // --- Botão "Não, obrigado" (Etapa 0) ---
        if (e.target.id === 'wizard-cancel-btn') {
            window.location.href = 'index.html'; // Volta para a home
        }
        
        // --- Botão "Adicionar ao Carrinho" (Etapa Final) ---
        if (e.target.id === 'wizard-add-btn') {
            const precoFinal = updatePriceSummary();
            
            const itemParaCarrinho = {
                name: "Camisa Exclusiva (Customizada)",
                image: "Imagens/Kangaroo/exkangaroo1.png", // Imagem placeholder
                price: precoFinal,
                color: wizardData.cor,
                size: wizardData.tamanho,
                description: `Material: ${wizardData.material}, Cores: ${wizardData.numCores}, Descrição: "${wizardData.description}" ${wizardData.referenceFile ? `(Ref: ${wizardData.referenceFile})` : ''}`
            };
            
            addCustomItemToCart(itemParaCarrinho);
            
            // Feedback e redirecionamento
            wizardTitle.textContent = "Adicionado! 🎉";
            wizardBody.innerHTML = `<p>Sua camisa exclusiva foi adicionada ao carrinho. Você será redirecionado em 3 segundos...</p>`;
            wizardNav.innerHTML = '';
            wizardSummary.style.display = 'none';
            
            setTimeout(() => {
                window.location.href = 'carrinho.html';
            }, 3000);
        }
    });

    /**
     * Listener do Botão "Criar minha camisa"
     */
    startBtn.addEventListener('click', () => {
        // 1. Animação de Fade Out da "Página de Pouso"
        landingSection.style.opacity = '0';
        
        setTimeout(() => {
            landingSection.style.display = 'none'; // Esconde
            
            // 2. Mostra o Assistente
            wizardSection.style.display = 'block';
            
            // 3. Renderiza a primeira etapa (Boas-vindas)
            renderStep(0); 
            
            // 4. Animação de Fade In do Assistente
            setTimeout(() => {
                wizardSection.style.opacity = '1';
            }, 50); // Pequeno delay
            
        }, 500); // 500ms = tempo da transição no CSS
    });
    
    // --- Inicialização ---
    // Carrega o carrossel da página de pouso
    setupPartnerContent('exclusivas-slider');
}
// =========================================================
