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
- gradient.png is the source for the app's lighting: deep navy, a cool wash near the top, a
  violet bloom out of the bottom-left.
- The app ships two derivatives in public/brand/, both generated from it:
  gradient.webp      1920px wide, quality 82 — the navigation rail, unblurred
  gradient-blur.webp 160px wide  — scaled up behind the page content, which is what makes the
                                   blur; a tiny file instead of a GPU filter.
- Regenerate after editing gradient.png:
    python3 -c "from PIL import Image, ImageFilter; im=Image.open('ConfigSync-brand-assets/gradient.png').convert('RGB'); w,h=im.size; im.resize((1920,round(1920*h/w)), Image.LANCZOS).save('public/brand/gradient.webp','WEBP',quality=82,method=6); im.resize((160,round(160*h/w)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(6)).save('public/brand/gradient-blur.webp','WEBP',quality=88,method=6)"
