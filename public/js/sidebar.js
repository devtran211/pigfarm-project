document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".menu-item.has-sub > .menu-link")
        .forEach(menu => {
            menu.addEventListener("click", e => {
                e.preventDefault();
                const parent = menu.parentElement;

                // Toggle class
                parent.classList.toggle("open");
            });
        });
});