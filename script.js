// script.js
// Highlight the currently centered game card on mobile devices using Intersection Observer.

document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.game-container');
  const cards = document.querySelectorAll('.game-card');
  const leftArrow = document.querySelector('.nav-arrow.left');
  const rightArrow = document.querySelector('.nav-arrow.right');
  const scrollDownBtn = document.getElementById('scroll-down');

  // Smooth scroll from hero to games section
  if (scrollDownBtn) {
    scrollDownBtn.addEventListener('click', () => {
      const target = document.getElementById('games-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // IntersectionObserver: highlight active card on small screens
  const initObserver = () => {
    if (window.innerWidth < 769 && 'IntersectionObserver' in window && container) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.intersectionRatio >= 0.6) {
              entry.target.classList.add('active');
            } else {
              entry.target.classList.remove('active');
            }
          });
        },
        {
          root: container,
          threshold: 0.6,
        }
      );
      cards.forEach((card) => observer.observe(card));
    }
  };
  initObserver();

  // Navigation arrows functionality for horizontal scrolling on mobile
  const updateArrowVisibility = () => {
    if (!container || !leftArrow || !rightArrow) return;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    // Hide left arrow if scrolled to start
    if (container.scrollLeft <= 5) {
      leftArrow.style.opacity = '0.3';
      leftArrow.style.pointerEvents = 'none';
    } else {
      leftArrow.style.opacity = '1';
      leftArrow.style.pointerEvents = 'auto';
    }
    // Hide right arrow if scrolled to end
    if (container.scrollLeft >= maxScrollLeft - 5) {
      rightArrow.style.opacity = '0.3';
      rightArrow.style.pointerEvents = 'none';
    } else {
      rightArrow.style.opacity = '1';
      rightArrow.style.pointerEvents = 'auto';
    }
  };

  const getScrollAmount = () => {
    // Each card's width + margin (we consider margin of 15% on each side)
    if (!cards.length) return 0;
    const card = cards[0];
    const cardStyle = getComputedStyle(card);
    const cardWidth = card.getBoundingClientRect().width;
    const marginRight = parseFloat(cardStyle.marginRight);
    const marginLeft = parseFloat(cardStyle.marginLeft);
    return cardWidth + marginLeft + marginRight;
  };

  if (leftArrow && rightArrow && container) {
    const scrollAmount = () => getScrollAmount();
    leftArrow.addEventListener('click', () => {
      container.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
    });
    rightArrow.addEventListener('click', () => {
      container.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    });
    container.addEventListener('scroll', updateArrowVisibility);
    // Initial state
    updateArrowVisibility();
  }

  // Reinitialize observer and arrow visibility on resize
  window.addEventListener('resize', () => {
    updateArrowVisibility();
  });
});