(() => {
    const storageKey = "timesheetlite.theme";
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function getPreference() {
        const preference = localStorage.getItem(storageKey);
        return preference === "light" || preference === "dark" ? preference : "auto";
    }

    function getEffectiveTheme(preference) {
        return preference === "auto"
            ? mediaQuery.matches ? "dark" : "light"
            : preference;
    }

    function applyTheme(preference) {
        const effective = getEffectiveTheme(preference);
        const darkSheet = document.getElementById("radzen-dark-theme");

        document.documentElement.dataset.themePreference = preference;
        document.documentElement.dataset.theme = effective;
        document.documentElement.style.colorScheme = effective;

        if (darkSheet) {
            darkSheet.media = preference === "dark"
                ? "all"
                : preference === "light"
                    ? "not all"
                    : "(prefers-color-scheme: dark)";
        }

        return { preference, effective };
    }

    window.timesheetLiteTheme = {
        get() {
            return applyTheme(getPreference());
        },
        set(preference) {
            if (preference === "auto") {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, preference);
            }

            return applyTheme(preference);
        },
        cycle() {
            const preference = getPreference();
            const next = preference === "auto"
                ? "dark"
                : preference === "dark"
                    ? "light"
                    : "auto";

            return this.set(next);
        }
    };

    mediaQuery.addEventListener("change", () => {
        if (getPreference() === "auto") {
            applyTheme("auto");
        }
    });

    applyTheme(getPreference());
})();
