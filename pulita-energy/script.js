/* Pulita Energy: shared script (all pages). No dependencies. */
(function () {
  "use strict";

  /* SETUP: paste the form service URL here. Both quote forms (Home and
     Contact) use it. While it is empty the forms tell visitors to call. */
  var FORM_ENDPOINT = "";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Loading screen
     Coming back to Home from a link inside the site shouldn't replay it, so
     Home links leave a note that the loading script reads. Scroll effects
     wait so they don't play behind the white screen.
     ------------------------------------------------------------------ */
  var introDelay = document.documentElement.classList.contains("loader-on") ? 4400 : 0;

  function initLoaderSkip() {
    document.addEventListener("click", function (event) {
      if (!event.target.closest('a[href="index.html"]')) return;
      try {
        sessionStorage.setItem("pulita-skip-loader", "1");
      } catch (error) {
        /* Without storage the loading screen simply plays again. */
      }
    });
  }

  /* Mobile menu
     ------------------------------------------------------------------ */
  function initMenu() {
    var toggle = document.querySelector(".menu-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    var desktop = window.matchMedia("(min-width: 56.3125rem)");

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    desktop.addEventListener("change", function (event) {
      if (event.matches) setOpen(false);
    });
  }

  /* Header border once the page has scrolled
     ------------------------------------------------------------------ */
  function initHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;

    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* Scroll reveal
     Add data-reveal to an element. Siblings inside [data-reveal-group]
     are staggered automatically.
     ------------------------------------------------------------------ */
  function initReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      items.forEach(function (item) {
        item.classList.add("is-visible");
      });
      return;
    }

    document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
      group.querySelectorAll("[data-reveal]").forEach(function (item, index) {
        item.style.setProperty("--reveal-delay", index * 70 + "ms");
      });
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  /* Quote form
     While FORM_ENDPOINT is empty the site has no way to deliver a request,
     so the page says so and gives the visitor the phone number instead of
     pretending the request was sent.
     ------------------------------------------------------------------ */
  function initQuoteForm() {
    var form = document.getElementById("quote-form");
    if (!form) return;

    var status = document.getElementById("form-status");
    var button = form.querySelector('button[type="submit"]');
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    form.setAttribute("novalidate", "");

    function setStatus(message, kind) {
      status.textContent = message;
      status.className = "form-status" + (kind ? " form-status--" + kind : "");
    }

    function setError(field, message) {
      var error = document.getElementById(field.id + "-error");
      error.textContent = message;
      error.hidden = !message;
      if (message) {
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-describedby", error.id);
      } else {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
      }
    }

    function validate(field) {
      var value = field.value.trim();
      var message = "";
      if (field.required && !value) {
        message = field.dataset.required;
      } else if (field.type === "email" && value && !emailPattern.test(value)) {
        message = "Enter an email address like name@company.com.";
      }
      setError(field, message);
      return !message;
    }

    var fields = Array.prototype.slice.call(form.querySelectorAll("[required], [type=email]"));

    fields.forEach(function (field) {
      /* Clear errors while typing, not on blur: removing an error on blur
         moves the submit button out from under the visitor's click. */
      ["input", "change"].forEach(function (type) {
        field.addEventListener(type, function () {
          if (field.hasAttribute("aria-invalid")) validate(field);
        });
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setStatus("");

      var invalid = fields.filter(function (field) {
        return !validate(field);
      });
      if (invalid.length) {
        invalid[0].focus();
        return;
      }

      if (!FORM_ENDPOINT) {
        setStatus(form.dataset.unavailable, "error");
        return;
      }

      button.disabled = true;
      fetch(FORM_ENDPOINT, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Request failed");
          form.reset();
          setStatus("Quote request sent.", "ok");
        })
        .catch(function () {
          setStatus(form.dataset.failed, "error");
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  /* Home page effects
     All skipped when the visitor asks for reduced motion. The numbers in the
     HTML are already final, so nothing is lost without them.
     ------------------------------------------------------------------ */
  function initScrollProgress() {
    var header = document.querySelector(".site-header");
    var bar = document.createElement("div");
    var queued = false;

    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    header.appendChild(bar);

    function update() {
      var range = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (range > 0 ? window.scrollY / range : 0) + ")";
      queued = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!queued) {
          queued = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  function initGeneratorTilt(hero) {
    var image = hero.querySelector(".hero__generator img");
    if (!image) return;

    hero.addEventListener("pointermove", function (event) {
      if (event.pointerType !== "mouse") return;
      var box = hero.getBoundingClientRect();
      var x = (event.clientX - box.left) / box.width - 0.5;
      var y = (event.clientY - box.top) / box.height - 0.5;
      image.style.setProperty("--ry", (x * 14).toFixed(2) + "deg");
      image.style.setProperty("--rx", (y * -9).toFixed(2) + "deg");
    });

    hero.addEventListener("pointerleave", function () {
      image.style.setProperty("--ry", "0deg");
      image.style.setProperty("--rx", "0deg");
    });
  }

  function initCountUp() {
    var counters = document.querySelectorAll("[data-count]");
    if (!counters.length || !("IntersectionObserver" in window)) return;

    function format(node, value) {
      node.textContent = value.toFixed(Number(node.dataset.decimals || 0)) + (node.dataset.suffix || "");
    }

    function run(node) {
      var target = Number(node.dataset.count);
      var start = null;

      function step(now) {
        if (start === null) start = now;
        var progress = Math.min((now - start) / 1400, 1);
        format(node, target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) window.requestAnimationFrame(step);
      }

      window.requestAnimationFrame(step);
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          run(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach(function (node) {
      format(node, 0);
      observer.observe(node);
    });
  }

  function initTileSpotlight() {
    if (!window.matchMedia("(hover: hover)").matches) return;

    document.querySelectorAll(".bento").forEach(function (bento) {
      bento.addEventListener("pointermove", function (event) {
        var tile = event.target.closest(".tile");
        if (!tile) return;
        var box = tile.getBoundingClientRect();
        tile.style.setProperty("--mx", event.clientX - box.left + "px");
        tile.style.setProperty("--my", event.clientY - box.top + "px");
      });
    });
  }

  function initHomeEffects() {
    var hero = document.querySelector(".hero");
    if (!hero || reduceMotion.matches) return;
    initScrollProgress();
    initGeneratorTilt(hero);
    initCountUp();
    initTileSpotlight();
  }

  /* Footer year
     ------------------------------------------------------------------ */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (node) {
      node.textContent = new Date().getFullYear();
    });
  }

  initLoaderSkip();
  initMenu();
  initHeader();
  initQuoteForm();
  window.setTimeout(function () {
    initReveal();
    initHomeEffects();
  }, introDelay);
  initYear();
})();
