// ======================================================
// KANGAROO WEAR - LÓGICA PRINCIPAL (FUNCTIONS.JS)
// ======================================================

// --- VARIÁVEIS GLOBAIS ---
let cartItems = [];
let appliedCoupon = null;
const WHATSAPP_NUMBER = '5592985979514'; 

// --- INICIALIZAÇÃO E COMPONENTES ---

/**
 * Configura a lógica do cabeçalho após ele ser carregado.
 */
function setupHeaderLogic() {
    setupScrolledHeader(); 
    setupMobileMenu(); 
    setupSearch(); 
    updateCartCount(); 

    // UX: Sincroniza o carrinho entre abas do navegador
    window.addEventListener('storage', (event) => {
        if (event.key === 'kangarooCart' || event.key === 'appliedCouponCode') {
            loadCart(); 
            updateCartCount();
            if (document.body.classList.contains('cart-page')) renderCartPage();
            if (document.body.classList.contains('checkout-page')) setupPaymentPage(); 
        }
    });
}

function loadComponent(elementId, componentUrl, callback = null) {
    const componentElement = document.getElementById(elementId);
    if (!componentElement) return;

    fetch(componentUrl)
        .then(response => {
            if (!response.ok) throw new Error(`Erro componente: ${response.statusText}`);
            return response.text();
        })
        .then(html => {
            componentElement.innerHTML = html;
            if (callback) callback();
        })
        .catch(error => {
            console.error(`Falha ao carregar ${componentUrl}:`, error);
        });
}

// --- GERENCIAMENTO DO CARRINHO ---

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
    if (storedCart) cartItems = JSON.parse(storedCart);
    
    const storedCouponCode = localStorage.getItem('appliedCouponCode');
    if (storedCouponCode && typeof COUPONS !== 'undefined') {
        appliedCoupon = COUPONS.find(c => c.code === storedCouponCode);
    }
}

function addItemToCart(productId, color, size, quantity = 1) {
    if (typeof PRODUCTS === 'undefined') return; 
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const itemIdentifier = `${productId}-${color}-${size}`;
    const existingItem = cartItems.find(item => item.identifier === itemIdentifier);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
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
    updateCartCount(); 
    if (document.body.classList.contains('cart-page')) renderCartPage();
}

/**
 * Adiciona um item customizado (Ex: Camisa Exclusiva) ao carrinho.
 */
function addCustomItemToCart(itemData) {
    const itemIdentifier = `custom-${Date.now()}`;
    cartItems.push({
        identifier: itemIdentifier,
        id: 'custom-exclusive', 
        name: itemData.name, 
        image: itemData.image, 
        price: itemData.price, 
        color: itemData.color, 
        size: itemData.size, 
        quantity: 1,
        customDetails: itemData.description // Guarda os detalhes do wizard
    });
    saveCart();
    updateCartCount();
}

function removeItem(identifier) {
    cartItems = cartItems.filter(item => item.identifier !== identifier);
    saveCart();
    updateCartCount();
    renderCartPage();
}

function updateCartItemQuantity(identifier, newQuantity) {
    const item = cartItems.find(item => item.identifier === identifier);
    if (item) {
        item.quantity = parseInt(newQuantity);
        if (item.quantity <= 0) {
            removeItem(identifier);
        } else {
            saveCart();
            renderCartPage();
        }
    }
}

function calculateTotals() {
    const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    const SHIPPING_THRESHOLD = 250.00; 
    const SHIPPING_COST = 25.00; 
    const shipping = (subtotal >= SHIPPING_THRESHOLD) ? 0.00 : (subtotal > 0 ? SHIPPING_COST : 0.00); 

    let discount = 0;
    if (appliedCoupon) {
        discount = subtotal * appliedCoupon.discount_percent;
    }

    const total = subtotal + shipping - discount;
    return { subtotal, shipping, discount, total };
}

// --- CUPONS ---

function handleCouponInput() {
    const input = document.getElementById('cupom-input');
    const messageEl = document.getElementById('cupom-status-message'); 
    if (!input || !messageEl || typeof COUPONS === 'undefined') return;

    const code = input.value.toUpperCase().trim();

    if (!code) {
        if (appliedCoupon) {
            appliedCoupon = null;
            localStorage.removeItem('appliedCouponCode');
            messageEl.textContent = `Cupom removido.`;
            messageEl.style.color = 'var(--color-primary)';
            updateCartSummary(); 
        } else {
            messageEl.textContent = "Digite um código.";
        }
        return;
    }
    
    if (appliedCoupon) {
        appliedCoupon = null;
        localStorage.removeItem('appliedCouponCode');
    }
    
    const coupon = COUPONS.find(c => c.code === code);

    if (!coupon) {
        messageEl.textContent = "❌ Cupom inválido.";
        messageEl.style.color = 'var(--color-highlight)';
        updateCartSummary(); 
        return;
    }
    
    if (coupon.target_collection && cartItems.length > 0) {
        const hasTargetProduct = cartItems.some(item => {
            if (item.id === 'custom-exclusive') return false;
            const productData = PRODUCTS.find(p => p.id === item.id);
            return productData && productData.collection === coupon.target_collection;
        });
        
        if (!hasTargetProduct) {
             messageEl.textContent = `❌ Cupom exclusivo para coleção ${coupon.target_collection}.`;
             messageEl.style.color = 'var(--color-highlight)';
             return;
        }
    }
    
    appliedCoupon = coupon;
    localStorage.setItem('appliedCouponCode', code);
    messageEl.textContent = `✅ Cupom aplicado! ${Math.round(coupon.discount_percent * 100)}% OFF.`;
    messageEl.style.color = 'var(--color-accent)';
    updateCartSummary(); 
}

// --- UTILITÁRIOS UI ---

function formatPrice(priceValue) {
    if (typeof priceValue === 'string') {
        priceValue = parseFloat(priceValue.replace('R$', '').replace('.', '').replace(',', '.').trim());
    }
    return `R$ ${priceValue.toFixed(2).replace('.', ',')}`;
}

function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') ? urlParams.get('q').toLowerCase() : null;
}

function updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) { 
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        cartCountElement.textContent = totalItems;
    }
}

function createColorSwatches(colors) {
    let swatchesHTML = '';
    const colorMap = { 'Preto': '#000', 'Cinza': '#808080', 'Branco': '#FFF', 'Vermelho': '#F00', 'Azul': '#00F', 'Verde': '#008000', 'Laranja': '#FFA500', 'Roxo': '#800080', 'Bege': '#F5F5DC', 'Rosa': '#FFC0CB' };
    for (const colorName of colors) {
        const cssColor = colorMap[colorName] || colorName.toLowerCase(); 
        swatchesHTML += `<span class="color-swatch" style="background-color: ${cssColor};" title="${colorName}"></span>`;
    }
    return swatchesHTML;
}

// --- RENDERIZAÇÃO ---

function renderProductCard(product) {
    const priceString = formatPrice(product.price);
    const colorSwatchesHTML = createColorSwatches(product.colors);
    return `
        <a href="produtos.html?id=${product.id}" class="product-card-link">
            <div class="product-card">
                <div class="product-image-container">
                    <img src="${product.image}" alt="${product.name}" class="product-main-img" loading="lazy">
                </div>
                <div class="product-info">
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
                    <div class="color-swatches">${colorSwatchesHTML}</div>
                </div>
            </div>
        </a>
    `;
}

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

function renderSearchPage() {
    const resultsGridEl = document.getElementById('search-results');
    const searchTitleEl = document.getElementById('search-title');
    const query = getSearchQuery(); 

    if (!resultsGridEl || !searchTitleEl) return;
    if (typeof PRODUCTS === 'undefined') return;

    if (!query) {
        searchTitleEl.textContent = 'O que você está procurando?';
        resultsGridEl.innerHTML = '<p class="search-no-results">Use a barra de busca acima para encontrar seus produtos favoritos!</p>';
        return;
    }

    const decodedQuery = decodeURIComponent(query);
    const results = searchProducts(decodedQuery); 

    if (results.length > 0) {
        searchTitleEl.textContent = `Resultados para "${decodedQuery}" (${results.length} itens)`;
        resultsGridEl.innerHTML = results.map(renderProductCard).join('');
    } else {
        searchTitleEl.textContent = `Nenhum resultado encontrado para "${decodedQuery}"`;
        resultsGridEl.innerHTML = `<p class="search-no-results">Sua busca não retornou resultados.</p>`;
    }
}

function renderCartPage() {
    const cartBody = document.getElementById('cart-list-body');
    if (!cartBody) return;

    if (cartItems.length === 0) {
        cartBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #555;">Seu carrinho está vazio!</td></tr>`;
    } else {
        cartBody.innerHTML = cartItems.map(item => `
            <tr>
                <td class="product-info-cell">
                    <img src="${item.image}" alt="${item.name}" class="cart-product-img">
                    <span>${item.name}</span>
                </td>
                <td>${item.color}</td>
                <td>${item.size}</td>
                <td>
                    <input type="number" min="1" value="${item.quantity}" class="cart-quantity-input" data-identifier="${item.identifier}">
                </td>
                <td>${formatPrice(item.price * item.quantity)}</td>
                <td>
                    <button class="btn-remove-item" data-identifier="${item.identifier}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }
    updateCartSummary(); 
    setupCartListeners(); 
}

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
    if (shippingEl) shippingEl.textContent = (shipping === 0 && subtotal > 0) ? 'GRÁTIS' : formatPrice(shipping);
    
    if (discount > 0 && discountLine) {
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

function renderThemeResults(container, products, themeName) {
    if (!container) return;
    if (products.length === 0) {
        container.innerHTML = `<div class="container"><h2 class="love-results-title">Coleção Love: ${themeName}</h2><div class="search-results-grid"><p class="search-no-results">Ops! Ainda não temos produtos deste tema.</p></div></div>`;
    } else {
        container.innerHTML = `<div class="container"><h2 class="love-results-title">Coleção Love: ${themeName}</h2><div class="search-results-grid">${products.map(renderProductCard).join('')}</div></div>`;
    }
}

function searchProducts(query) {
    if (!query || typeof PRODUCTS === 'undefined') return [];
    const lowerCaseQuery = query.toLowerCase();
    return PRODUCTS.filter(product => {
        return product.name.toLowerCase().includes(lowerCaseQuery) || product.tags.join(' ').toLowerCase().includes(lowerCaseQuery);
    });
}

function findProductsByTags(requiredTags = []) {
    if (typeof PRODUCTS === 'undefined' || requiredTags.length === 0) return [];
    const lowerCaseTags = requiredTags.map(tag => tag.toLowerCase());
    return PRODUCTS.filter(product => {
        const productTags = product.tags.map(t => t.toLowerCase());
        return lowerCaseTags.every(tag => productTags.includes(tag));
    });
}


// --- SETUP LISTENERS ---

function setupCartListeners() {
    document.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => removeItem(e.currentTarget.dataset.identifier));
    });
    document.querySelectorAll('.cart-quantity-input').forEach(input => {
        input.addEventListener('input', (e) => updateCartItemQuantity(e.currentTarget.dataset.identifier, e.target.value));
    });
}

function setupCheckoutButton() {
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cartItems.length > 0) {
                saveCart();
                window.location.href = 'pagamento.html';
            } else {
                alert('Seu carrinho está vazio!'); 
            }
        });
    }
}

function setupProductPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (!productId || typeof PRODUCTS === 'undefined') { window.location.href = 'index.html'; return; }
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) { window.location.href = 'index.html'; return; }

    // SEO Update
    document.title = `${product.name} | KANGAROO WEAR`;
    const mainImage = document.getElementById('main-product-image');
    if (mainImage) mainImage.alt = product.name;
    const metaDesc = document.getElementById('product-description');
    if (metaDesc) metaDesc.setAttribute('content', `Compre sua ${product.name} em ${product.material}. Qualidade premium.`);

    document.getElementById('main-product-image').src = product.image;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-rating').innerHTML = `<i class="fas fa-star"></i> ${product.rating}`;
    document.getElementById('product-reviews').textContent = `(${product.reviews} reviews)`;
    document.getElementById('product-price').textContent = formatPrice(product.price);
    document.getElementById('product-material').textContent = product.material;

    const colorSelect = document.getElementById('color-select');
    colorSelect.innerHTML = product.colors.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join('');
    
    const sizeSelect = document.getElementById('size-select');
    sizeSelect.innerHTML = product.sizes.map(s => `<option value="${s}">${s}</option>`).join('');

    document.getElementById('add-to-cart-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const color = colorSelect.value;
        const size = sizeSelect.value;
        const qty = parseInt(document.getElementById('quantity-input').value);
        addItemToCart(product.id, color, size, qty);
        
        const msg = document.getElementById('add-to-cart-message');
        msg.textContent = 'Adicionado ao carrinho! 🎉';
        setTimeout(() => { msg.textContent = ''; }, 2000);
    });

    // Related Products Logic
    const relatedProducts = PRODUCTS.filter(p => p.collection === product.collection && p.id !== product.id);
    const relatedSlider = document.getElementById('related-products-slider');
    if (relatedSlider && relatedProducts.length > 0) {
        relatedSlider.innerHTML = relatedProducts.map(renderProductCard).join('');
    } else if (relatedSlider) {
        document.querySelector('.related-products-section').style.display = 'none';
    }
    
    setupInternalBannerCarousel('internal-banner-carousel-produto'); 
}

function generateWhatsAppOrderLink(formData) {
    const totals = calculateTotals(); 
    const normalize = (str) => String(str).toUpperCase().replace(/\s/g, '');
    const isPayerSame = normalize(formData.nome_cliente) === normalize(formData.nome_pagador) && normalize(formData.cpf_cliente) === normalize(formData.cpf_pagador);
    
    let msg = `Olá, Kangaroo!%0A%0ASou: ${formData.nome_cliente}%0ACPF/CNPJ: ${formData.cpf_cliente}%0A--------------------------------%0A`;
    if (!isPayerSame) msg += `O(a) pagador(a) é:%0ANome: ${formData.nome_pagador}%0ACPF: ${formData.cpf_pagador}%0A--------------------------------%0A`;
    
    msg += `Em meu Kangaroo Cart, tem:%0A`;
    cartItems.forEach((item) => {
        msg += `* ${item.name} | Qtd: ${item.quantity} | Tam: ${item.size} | Cor: ${item.color}%0A`;
        if (item.id === 'custom-exclusive') msg += `   -> (Detalhes: ${item.customDetails})%0A`;
    });
    
    msg += `--------------------------------%0ACupom: ${appliedCoupon ? appliedCoupon.code : 'Nenhum'}%0AFrete: ${totals.shipping === 0 ? 'GRÁTIS' : formatPrice(totals.shipping)}%0AValor do pedido: ${formatPrice(totals.total)}%0A--------------------------------%0A`;
    msg += `Dados de entrega%0ARua: ${formData.rua}%0ANº: ${formData.numero}%0ABairro: ${formData.bairro}%0ACidade: ${formData.cidade}%0AEstado: ${formData.estado}%0ACEP: ${formData.cep}%0A`;
    
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

function setupPaymentPage() {
    const itemsContainer = document.getElementById('checkout-summary-items');
    if (itemsContainer) {
        itemsContainer.innerHTML = cartItems.map(item => `
            <div class="summary-item-line">
                <span>${item.name} (${item.size}, ${item.color}) x${item.quantity}</span>
                <span>${formatPrice(item.price * item.quantity)}</span>
            </div>
        `).join('');
    }
    
    const totals = calculateTotals();
    document.getElementById('co_subtotal').textContent = formatPrice(totals.subtotal);
    document.getElementById('co_shipping').textContent = (totals.shipping === 0 && totals.subtotal > 0) ? 'GRÁTIS' : formatPrice(totals.shipping);
    document.getElementById('co_total').textContent = formatPrice(totals.total);
    
    const discountLine = document.getElementById('co_discount_line');
    if (totals.discount > 0 && discountLine) {
        discountLine.style.display = 'flex';
        document.getElementById('co_discount').textContent = `- ${formatPrice(totals.discount)}`;
    }

    const payerCheckbox = document.getElementById('mesmos-dados-check');
    if (payerCheckbox) {
        payerCheckbox.addEventListener('change', function() {
            document.getElementById('pagador-nome').value = this.checked ? document.getElementById('nome-completo').value : '';
            document.getElementById('pagador-cpf').value = this.checked ? document.getElementById('cpf-cnpj').value : '';
        });
    }

    // Checkout via WhatsApp
    const contactForm = document.getElementById('contact-info-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
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
            window.open(generateWhatsAppOrderLink(formData), '_blank');
        });
    }
    
    // Modal Cancelamento
    const cancelBtn = document.getElementById('cancel-order-btn');
    const modal = document.getElementById('cancel-modal');
    if (cancelBtn && modal) {
        cancelBtn.addEventListener('click', (e) => { e.preventDefault(); modal.style.display = 'flex'; });
        document.getElementById('modal-close-btn').addEventListener('click', () => modal.style.display = 'none');
        document.getElementById('modal-confirm-cancel').addEventListener('click', () => {
            cartItems = []; saveCart(); window.location.href = 'index.html';
        });
    }
}

// --- SETUP DE CARROSSELS E COMPONENTES VISUAIS ---

function setupInternalBannerCarousel(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    const items = carousel.querySelectorAll('.internal-banner-item');
    if (items.length <= 1) return;

    let currentIndex = 0;
    setInterval(() => {
        const nextIndex = (currentIndex + 1) % items.length;
        items[currentIndex].classList.remove('active');
        items[nextIndex].classList.add('active');
        currentIndex = nextIndex;
    }, 4000);
}

function setupConstructionMarquee(elementId, message) {
    const marqueeEl = document.getElementById(elementId);
    if (!marqueeEl) return;
    marqueeEl.innerHTML = `<span>${message} | ${message}</span><span>${message} | ${message}</span>`;
}

function setupPartnerContent(sliderId) {
    const slider = document.getElementById(sliderId);
    if (slider && typeof PARTNERS !== 'undefined') {
        slider.innerHTML = PARTNERS.map(renderPartnerCard).join('');
        setTimeout(() => scrollSlider(sliderId, 0), 100);
    }
}

function setupProductSlider(sliderId, requiredTags = []) {
    const slider = document.getElementById(sliderId);
    if (!slider || typeof PRODUCTS === 'undefined') return;
    const filtered = findProductsByTags(requiredTags);
    slider.innerHTML = filtered.length ? filtered.map(renderProductCard).join('') : '<p>Nenhum produto encontrado.</p>';
}

function setupThemeCarouselActions() {
    const links = document.querySelectorAll('#theme-carousel-slider .theme-card-link');
    const container = document.getElementById('love-theme-results');
    if (!links.length || !container) return;

    let activeTheme = null;
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const theme = link.dataset.theme;
            const themeName = link.querySelector('h3').textContent;
            
            links.forEach(l => l.classList.remove('active-theme'));
            if (activeTheme === theme) {
                container.classList.remove('visible');
                activeTheme = null;
            } else {
                const products = findProductsByTags(['love', theme]);
                renderThemeResults(container, products, themeName);
                container.classList.add('visible');
                link.classList.add('active-theme');
                activeTheme = theme;
                
                setTimeout(() => {
                    container.querySelectorAll('.product-card-link').forEach((c, i) => setTimeout(() => c.classList.add('in'), i * 100));
                    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300);
            }
        });
    });
}

function setupMobileMenu() {
    const menu = document.querySelector('.mobile-menu');
    const toggle = document.querySelector('.menu-toggle');
    const close = document.querySelector('.close-menu');
    if (!menu || !toggle || !close) return;

    toggle.addEventListener('click', () => { menu.classList.add('open'); document.body.style.overflow = 'hidden'; });
    close.addEventListener('click', () => { menu.classList.remove('open'); document.body.style.overflow = 'auto'; });
    
    document.querySelectorAll('.mobile-dropdown-toggle').forEach(t => {
        t.addEventListener('click', (e) => {
            e.preventDefault();
            t.nextElementSibling.classList.toggle('active');
        });
    });
}

function setupScrolledHeader() {
    const header = document.querySelector('.header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });
}

function setupSearch() {
    const input = document.querySelector('.header .search-input');
    if (!input) return;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim() !== '') {
            e.preventDefault();
            window.location.href = `busca.html?q=${encodeURIComponent(input.value.trim())}`;
        }
    });
}

function setupCartPage() {
    if (document.body.classList.contains('cart-page')) {
        renderCartPage();
        setupCheckoutButton();
        const cBtn = document.getElementById('cupom-btn');
        if (cBtn) cBtn.addEventListener('click', handleCouponInput);
        setupShareCartButton();
    }
}

function scrollSlider(sliderId, direction) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    const first = slider.querySelector('a, div[role="button"], .recent-work-card');
    if (!first) return;
    
    const style = window.getComputedStyle(first);
    const amount = (first.offsetWidth + parseInt(style.marginRight)) * direction;
    slider.scrollBy({ left: amount, behavior: 'smooth' });
}

function copyToClipboard(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.classList.add('clipboard-helper');
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
}

function setupShareCartButton() {
    const btn = document.getElementById('share-cart-btn');
    const msg = document.getElementById('share-cart-success');
    if (!btn || !msg) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (cartItems.length === 0) {
            btn.style.display = 'none';
            msg.textContent = 'Carrinho vazio!';
            msg.style.display = 'inline';
            setTimeout(() => { btn.style.display = 'inline'; msg.style.display = 'none'; }, 2000);
            return;
        }
        const b64 = btoa(JSON.stringify(cartItems));
        copyToClipboard(`${window.location.origin}${window.location.pathname}?cart=${b64}`);
        
        btn.style.display = 'none';
        msg.textContent = 'Link copiado!';
        msg.style.display = 'inline';
        setTimeout(() => { btn.style.display = 'inline'; msg.style.display = 'none'; }, 2000);
    });
}


// =========================================================
// LÓGICA DA PÁGINA EXCLUSIVAS (ASSISTENTE INTERATIVO)
// =========================================================

function setupExclusivasPage() {
    const landingSection = document.getElementById('landing-section');
    const wizardSection = document.getElementById('wizard-section');
    const startBtn = document.getElementById('start-wizard-btn');

    // --- CARROSSEL ROLETA INFINITA DE TRABALHOS ---
    function setupRecentWorks() {
        const slider = document.getElementById('recent-works-slider');
        if (!slider) return;

        // 1. Dados e Duplicação para Loop
        // (Usa a mesma imagem ex01.jpg como solicitado)
        const WORK_ITEM = { title: "Arte Exclusiva", desc: "Design Personalizado", image: "ex01.jpg" };
        const BASE_WORKS = Array(10).fill(WORK_ITEM);
        const RECENT_WORKS_DATA = [...BASE_WORKS, ...BASE_WORKS, ...BASE_WORKS];

        // 2. Renderização
        slider.innerHTML = RECENT_WORKS_DATA.map(work => `
            <div class="recent-work-card">
                <img src="Imagens/Fotos Exclusivas/${work.image}" alt="${work.title}" loading="lazy">
                <div class="recent-work-overlay">
                    <h3>${work.title}</h3>
                    <p>${work.desc}</p>
                </div>
            </div>
        `).join('');

        // 3. Animação Fluida (RequestAnimationFrame)
        let animationId;
        let currentScroll = 0;
        const speed = 1.5; // Velocidade
        
        // Medidas aproximadas para o cálculo do loop
        const cardWidth = 250; 
        const gap = 30; 
        const totalWidth = (cardWidth + gap) * BASE_WORKS.length;

        function animateRoleta() {
            currentScroll += speed;
            slider.scrollLeft = currentScroll;

            // Loop Infinito
            if (currentScroll >= totalWidth) {
                currentScroll = 0;
                slider.scrollLeft = 0;
            }

            // Efeito Fisheye (Zoom no Centro)
            const centerPoint = slider.scrollLeft + (slider.clientWidth / 2);
            const cards = slider.querySelectorAll('.recent-work-card');

            cards.forEach(card => {
                // Centro do card relativo ao slider
                const cardCenter = (card.offsetLeft - slider.offsetLeft) + (card.offsetWidth / 2);
                const dist = Math.abs(centerPoint - cardCenter);
                const range = 350; // Raio de efeito

                if (dist < range) {
                    const intensity = 1 - (dist / range); // 0 a 1
                    const scale = 0.8 + (0.35 * intensity); 
                    const opacity = 0.5 + (0.5 * intensity);
                    const gray = 100 - (100 * intensity);

                    card.style.transform = `scale(${scale})`;
                    card.style.filter = `grayscale(${gray}%)`;
                    card.style.opacity = opacity;
                    
                    // Texto aparece no centro
                    const overlay = card.querySelector('.recent-work-overlay');
                    if(overlay) overlay.style.opacity = intensity > 0.8 ? 1 : 0;
                } else {
                    // Estado padrão
                    card.style.transform = 'scale(0.8)';
                    card.style.filter = 'grayscale(100%)';
                    card.style.opacity = '0.5';
                    const overlay = card.querySelector('.recent-work-overlay');
                    if(overlay) overlay.style.opacity = 0;
                }
            });

            animationId = requestAnimationFrame(animateRoleta);
        }
        
        animationId = requestAnimationFrame(animateRoleta);
        // Mouse events removidos pois o CSS tem pointer-events: none
    }
    
    setupRecentWorks();

    // Se não houver wizard (ex: erro de carregamento), para por aqui
    if (!landingSection || !wizardSection || !startBtn) return;

    // --- LÓGICA DO ASSISTENTE (WIZARD) ---
    const wizardTitle = document.getElementById('wizard-title');
    const wizardBody = document.getElementById('wizard-step-body');
    const wizardNav = document.getElementById('wizard-navigation');
    const wizardSummary = document.getElementById('wizard-price-summary');
    const kangarooImg = document.getElementById('kangaroo-image');

    const PRECOS = {
        ARTE_UNICA: 150.00, // Preço base atualizado
        ALGODAO: { padrao: 45.00, premium: 65.00 },
        TAMANHO: { PP: 0, P: 0, M: 10, G: 15, GG: 18, XG: 25, XXG: 50 }
    };

    let wizardData = {
        step: 0,
        description: "",
        temReferencia: false,
        material: "padrao",
        tamanho: "M",
        cor: "Preto"
    };

    const STEPS = ["welcome", "description", "reference", "material", "size-color", "final"];

    function setKangaroo(imgName) {
        kangarooImg.style.transform = 'scale(0.95)';
        kangarooImg.style.opacity = '0.7';
        setTimeout(() => {
            kangarooImg.src = `Imagens/Banners/${imgName}.png`;
            kangarooImg.style.transform = 'scale(1)';
            kangarooImg.style.opacity = '1';
        }, 200);
    }

    function updatePriceSummary() {
        const total = PRECOS.ARTE_UNICA + PRECOS.ALGODAO[wizardData.material] + PRECOS.TAMANHO[wizardData.tamanho];
        document.getElementById('price-total').textContent = formatPrice(total);
        return total;
    }

    function renderStep(index) {
        wizardData.step = index;
        const stepName = STEPS[index];
        wizardBody.innerHTML = '';
        wizardNav.innerHTML = '';
        wizardSummary.style.display = 'none';
        
        let navHTML = (index > 0) ? `<button id="wizard-back-btn" class="btn btn-secondary wizard-btn-back">← Voltar</button>` : `<div></div>`;

        switch(stepName) {
            case "welcome":
                setKangaroo('exkangaroo1');
                wizardTitle.textContent = "Vamos criar sua camisa exclusiva!";
                wizardBody.innerHTML = `<p>Você nos diz sua ideia, e nossos artistas a transformarão em uma estampa única. Prazo: 4 a 10 dias úteis.</p>`;
                navHTML += `<div style="display:flex; gap:10px;"><button id="wizard-cancel-btn" class="btn btn-secondary">Não, obrigado</button><button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Concordo, vamos lá!</button></div>`;
                break;
            case "description":
                setKangaroo('exkangaroo2');
                wizardTitle.textContent = "Como quer sua estampa?";
                wizardBody.innerHTML = `<p>Me diga de forma detalhada, especificando cenário, personagens, cores, posturas e afins.</p><textarea id="wizard-desc-input" class="wizard-textarea" placeholder="Ex: Quero meu gato...">${wizardData.description}</textarea>`;
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
            case "reference":
                setKangaroo('exkangaroo3');
                wizardTitle.textContent = "Você tem alguma referência?";
                wizardBody.innerHTML = `<p>Se tiver imagens de referência, nos avise. Você poderá enviá-las pelo WhatsApp.</p><div class="wizard-balloons-group" id="wizard-ref-group"><button class="wizard-btn-balloon" data-value="true">Sim, tenho referências</button><button class="wizard-btn-balloon" data-value="false">Não, só a descrição</button></div>`;
                wizardBody.querySelector(`.wizard-btn-balloon[data-value="${wizardData.temReferencia}"]`).classList.add('selected');
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
            case "material":
                setKangaroo('exkangaroo4');
                wizardTitle.textContent = "Qual material você prefere?";
                wizardBody.innerHTML = `<p>Escolha o tipo de algodão.</p><div class="wizard-balloons-group" id="wizard-material-group"><button class="wizard-btn-balloon" data-value="padrao">Algodão Padrão</button><button class="wizard-btn-balloon" data-value="premium">Algodão Premium</button></div>`;
                wizardBody.querySelector(`.wizard-btn-balloon[data-value="${wizardData.material}"]`).classList.add('selected');
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
            case "size-color":
                setKangaroo('exkangaroo5');
                wizardTitle.textContent = "Qual o tamanho e cor da camisa?";
                wizardBody.innerHTML = `<p>O preço varia para tamanhos maiores.</p>
                    <div class="wizard-balloons-group" id="wizard-size-group">${Object.keys(PRECOS.TAMANHO).map(s => `<button class="wizard-btn-balloon" data-value="${s}">${s}</button>`).join('')}</div>
                    <p style="margin-top: 25px;">Cor da camisa:</p>
                    <div class="wizard-balloons-group" id="wizard-color-group"><button class="wizard-btn-balloon" data-value="Preto">Preto</button><button class="wizard-btn-balloon" data-value="Branco">Branco</button><button class="wizard-btn-balloon" data-value="Cinza">Cinza</button></div>`;
                wizardBody.querySelector(`#wizard-size-group [data-value="${wizardData.tamanho}"]`).classList.add('selected');
                wizardBody.querySelector(`#wizard-color-group [data-value="${wizardData.cor}"]`).classList.add('selected');
                navHTML += `<button id="wizard-next-btn" class="btn btn-primary wizard-btn-nav">Continuar</button>`;
                break;
            case "final":
                setKangaroo('exkangaroo4');
                wizardTitle.textContent = "Estamos quase acabando!";
                wizardBody.innerHTML = `
                    <p>Confira seu pedido. O valor total será exibido abaixo.</p>
                    <div class="wizard-final-summary">
                        <strong>Descrição:</strong><p class="summary-description">"${wizardData.description}"</p><hr>
                        <strong>Referências:</strong><p>${wizardData.temReferencia ? 'Sim' : 'Não'}</p><hr>
                        <strong>Material:</strong><p>${wizardData.material === 'padrao' ? 'Algodão Padrão' : 'Algodão Premium'}</p><hr>
                        <strong>Tamanho/Cor:</strong><p>${wizardData.tamanho} - ${wizardData.cor}</p>
                    </div>`;
                wizardSummary.style.display = 'block';
                updatePriceSummary();
                navHTML += `<button id="wizard-add-btn" class="btn btn-primary wizard-btn-add-cart"><i class="fas fa-shopping-cart"></i> Adicionar ao Carrinho</button>`;
                break;
        }
        wizardNav.innerHTML = navHTML;
        wizardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Event Delegation do Wizard
    wizardBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.wizard-btn-balloon');
        if (!btn) return;
        
        if (btn.parentElement.id === 'wizard-ref-group') wizardData.temReferencia = (btn.dataset.value === 'true');
        if (btn.parentElement.id === 'wizard-material-group') wizardData.material = btn.dataset.value;
        if (btn.parentElement.id === 'wizard-size-group') wizardData.tamanho = btn.dataset.value;
        if (btn.parentElement.id === 'wizard-color-group') wizardData.cor = btn.dataset.value;

        // Update Visual
        btn.parentElement.querySelectorAll('.wizard-btn-balloon').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });

    wizardNav.addEventListener('click', (e) => {
        if (e.target.id === 'wizard-next-btn') {
            if (STEPS[wizardData.step] === 'description') {
                const val = document.getElementById('wizard-desc-input').value;
                if (!val) return alert('Por favor, descreva sua ideia.');
                wizardData.description = val;
            }
            renderStep(wizardData.step + 1);
        } else if (e.target.id === 'wizard-back-btn') {
            renderStep(wizardData.step - 1);
        } else if (e.target.id === 'wizard-cancel-btn') {
            window.location.href = 'index.html';
        } else if (e.target.id === 'wizard-add-btn') {
            const total = updatePriceSummary();
            let desc = `Material: ${wizardData.material}, Desc: "${wizardData.description}"`;
            if (wizardData.temReferencia) desc += " (AVISO: Cliente tem referências!)";
            
            addCustomItemToCart({
                name: "Camisa Exclusiva (Customizada)",
                image: "Imagens/Banners/exkangaroo1.png",
                price: total,
                color: wizardData.cor,
                size: wizardData.tamanho,
                description: desc
            });
            
            wizardTitle.textContent = "Adicionado! 🎉";
            wizardBody.innerHTML = `<p>Redirecionando para o carrinho...</p>`;
            wizardNav.innerHTML = '';
            wizardSummary.style.display = 'none';
            setTimeout(() => window.location.href = 'carrinho.html', 2000);
        }
    });

    startBtn.addEventListener('click', () => {
        landingSection.style.opacity = '0';
        setTimeout(() => {
            landingSection.style.display = 'none';
            wizardSection.style.display = 'block';
            renderStep(0);
            setTimeout(() => wizardSection.style.opacity = '1', 50);
        }, 500);
    });
}
