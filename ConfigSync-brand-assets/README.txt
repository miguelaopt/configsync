ConfigSync brand assets

Primary brand colors
- Background: #161826
- Surface: #1C1F30
- Text: #E9E9ED
- Accent: #9184D9
- Accent light: #B7A6FF

Recommended website usage
- Navbar / header: configsync-logo-horizontal.svg
- Compact sidebar or favicon: configsync-mark.svg
- Browser favicon: favicon.ico
- Apple touch icon: apple-touch-icon.png
- PWA Android icons: android-chrome-192x192.png / android-chrome-512x512.png
- Light backgrounds: configsync-logo-horizontal-light.svg

Notes
- SVG files are the preferred web format because they stay sharp at every size.
- PNG exports are included for places that do not support SVG.
- The symbol is a clean vector recreation of the approved ConfigSync concept, designed around two interlocking configuration/sync forms.

App background
- backdrop-ribbon.png is the source in use: a violet-blue ribbon curving out of the bottom-left
  across a near-black field. public/brand/ holds its two derivatives (see below).
- gradient.png is the previous artwork, kept for reference. gradient.py and gradient-4k.webp
  belong to it, not to the ribbon.
- The app ships two derivatives in public/brand/, both generated from it:
  gradient.webp      1920px wide, quality 82 — the navigation rail, unblurred
  gradient-blur.webp 160px wide  — scaled up behind the page content, which is what makes the
                                   blur; a tiny file instead of a GPU filter.
- gradient-4k.webp is the same artwork at 3840x2160, rebuilt from the fitted formula rather than
  upscaled, so it is sharp at any size. gradient.py rebuilds it (or any size) from scratch:
      python3 ConfigSync-brand-assets/gradient.py 3840 2160 out.png
- Regenerate the app's two derivatives after editing backdrop-ribbon.png:
    python3 -c "from PIL import Image, ImageFilter; im=Image.open('ConfigSync-brand-assets/backdrop-ribbon.png').convert('RGB'); im.resize((3840,2160), Image.LANCZOS).save('public/brand/gradient.webp','WEBP',quality=90,method=6); im.filter(ImageFilter.GaussianBlur(26)).save('public/brand/gradient-blur.webp','WEBP',quality=88,method=6)"
- The same, for the older gradient.png artwork:
    python3 -c "from PIL import Image, ImageFilter; im=Image.open('ConfigSync-brand-assets/gradient.png').convert('RGB'); w,h=im.size; im.resize((1920,round(1920*h/w)), Image.LANCZOS).save('public/brand/gradient.webp','WEBP',quality=82,method=6); im.resize((160,round(160*h/w)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(6)).save('public/brand/gradient-blur.webp','WEBP',quality=88,method=6)"
