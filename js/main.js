"use strict";

function setupNavigation() {
  const header = document.querySelector("[data-site-header]");
  if (!header) return;

  const toggle = header.querySelector(".menu-toggle");
  const navigation = header.querySelector(".site-nav");
  const sectionLinks = [...navigation.querySelectorAll('a[href^="#"]')];
  const sections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let scrollFrame = null;

  const closeMenu = () => {
    header.classList.remove("is-menu-open");
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
  };

  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 18);
    const marker = window.scrollY + window.innerHeight * 0.34;
    let activeSection = sections[0] || null;
    sections.forEach((section) => {
      if (section.offsetTop <= marker) activeSection = section;
    });
    sectionLinks.forEach((link) => {
      const isActive = activeSection && link.getAttribute("href") === "#" + activeSection.id;
      link.classList.toggle("is-active", Boolean(isActive));
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    scrollFrame = null;
  };

  toggle.addEventListener("click", () => {
    const willOpen = !header.classList.contains("is-menu-open");
    header.classList.toggle("is-menu-open", willOpen);
    document.body.classList.toggle("menu-open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
    toggle.setAttribute("aria-label", willOpen ? "Fechar menu" : "Abrir menu");
  });

  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("pointerdown", (event) => {
    if (header.classList.contains("is-menu-open") && !header.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) closeMenu();
  }, { passive: true });
  window.addEventListener("scroll", () => {
    if (scrollFrame === null) scrollFrame = window.requestAnimationFrame(updateHeader);
  }, { passive: true });

  updateHeader();
}

function setupCarousel(root) {
  const viewport = root.querySelector(".carousel__viewport");
  const track = root.querySelector(".carousel__track");
  const slides = [...track.children];
  const previous = root.querySelector("[data-carousel-prev]");
  const next = root.querySelector("[data-carousel-next]");
  const dotsHost = root.querySelector("[data-carousel-dots]");
  const isReviews = root.dataset.carousel === "reviews";
  let index = 0;
  let startX = 0;
  let deltaX = 0;
  let dragging = false;
  let autoplayId = null;

  const visibleSlides = () => Math.max(1, Number.parseInt(getComputedStyle(root).getPropertyValue("--visible"), 10) || 1);
  const maxIndex = () => Math.max(0, slides.length - visibleSlides());
  const slideStep = () => isReviews ? visibleSlides() : 1;

  const stopAutoplay = () => {
    if (autoplayId !== null) {
      window.clearInterval(autoplayId);
      autoplayId = null;
    }
  };

  const syncDots = () => {
    if (!dotsHost) return;
    const wanted = isReviews ? Math.ceil(slides.length / visibleSlides()) : slides.length;
    if (dotsHost.children.length === wanted) return;
    dotsHost.replaceChildren();
    for (let dotIndex = 0; dotIndex < wanted; dotIndex += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.dataset.slideDot = String(dotIndex);
      dot.setAttribute("aria-label", "Ir para o item " + (dotIndex + 1));
      dot.addEventListener("click", () => {
        stopAutoplay();
        index = Math.min(isReviews ? dotIndex * visibleSlides() : dotIndex, maxIndex());
        render();
      });
      dotsHost.append(dot);
    }
  };

  const render = () => {
    index = Math.min(Math.max(index, 0), maxIndex());
    syncDots();
    const slide = slides[index];
    const centerGap = slide && visibleSlides() === 1
      ? Math.max((viewport.clientWidth - slide.offsetWidth) / 2, 0)
      : 0;
    const offset = slide ? slide.offsetLeft - centerGap : 0;
    track.style.transform = "translate3d(" + (-offset) + "px,0,0)";
    previous.disabled = index === 0;
    next.disabled = index === maxIndex();
    const activeDotIndex = isReviews ? Math.floor(index / visibleSlides()) : index;
    const dots = [...root.querySelectorAll("[data-slide-dot]")];
    const dotWindowStart = Math.max(0, Math.min(activeDotIndex - 2, dots.length - 5));
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === activeDotIndex);
      dot.setAttribute("aria-current", dotIndex === activeDotIndex ? "true" : "false");
      dot.hidden = isReviews && dots.length > 7 && (dotIndex < dotWindowStart || dotIndex >= dotWindowStart + 5);
    });
  };

  previous.addEventListener("click", () => { stopAutoplay(); index -= slideStep(); render(); });
  next.addEventListener("click", () => { stopAutoplay(); index += slideStep(); render(); });
  viewport.addEventListener("pointerdown", (event) => { stopAutoplay(); dragging = true; startX = event.clientX; deltaX = 0; viewport.setPointerCapture(event.pointerId); });
  viewport.addEventListener("pointermove", (event) => { if (dragging) deltaX = event.clientX - startX; });
  viewport.addEventListener("pointerup", () => { if (!dragging) return; dragging = false; if (Math.abs(deltaX) > 45) index += deltaX < 0 ? slideStep() : -slideStep(); render(); });
  viewport.addEventListener("pointercancel", () => { dragging = false; render(); });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    stopAutoplay();
    index += event.key === "ArrowRight" ? slideStep() : -slideStep();
    render();
  });

  const refreshReviewText = () => {
    if (!isReviews) return;
    slides.forEach((slide) => {
      const text = slide.querySelector(".review-card__text");
      const button = slide.querySelector(".review-card__more");
      if (!text || !button) return;
      const expanded = text.classList.contains("is-expanded");
      button.classList.toggle("is-needed", expanded || text.scrollHeight > text.clientHeight + 1);
    });
  };

  if (isReviews) {
    root.addEventListener("focusin", stopAutoplay, { once: true });
    root.querySelectorAll(".review-card__more").forEach((button) => {
      button.addEventListener("click", () => {
        stopAutoplay();
        const text = document.getElementById(button.getAttribute("aria-controls"));
        const expanded = button.getAttribute("aria-expanded") === "true";
        text.classList.toggle("is-expanded", !expanded);
        button.setAttribute("aria-expanded", String(!expanded));
        button.textContent = expanded ? "Ler mais" : "Mostrar menos";
        refreshReviewText();
      });
    });

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      autoplayId = window.setInterval(() => {
        index = index >= maxIndex() ? 0 : Math.min(index + slideStep(), maxIndex());
        render();
      }, 6500);
    }
  }

  window.addEventListener("resize", () => { render(); refreshReviewText(); }, { passive: true });
  render();
  window.requestAnimationFrame(refreshReviewText);
}

setupNavigation();
document.querySelectorAll("[data-carousel]").forEach(setupCarousel);
