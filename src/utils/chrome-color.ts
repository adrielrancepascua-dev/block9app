const cache = new Map<string, string>();

const mix = (value: number) => Math.round(value * 0.84);

export function applyChromeColor(color: string) {
  document.documentElement.style.setProperty("--chrome", color);
  document.documentElement.style.backgroundColor = color;
  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
    node.setAttribute("content", color);
    node.removeAttribute("media");
  });
}

export function chromeColorFromImage(url: string) {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith("/") && !url.startsWith(window.location.origin)) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = 24;
        const height = 8;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("canvas");
        const slice = Math.max(1, Math.round(image.naturalHeight * 0.14));
        context.drawImage(
          image,
          0,
          image.naturalHeight - slice,
          image.naturalWidth,
          slice,
          0,
          0,
          width,
          height
        );
        const pixels = context.getImageData(0, 0, width, height).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] < 200) continue;
          red += pixels[index];
          green += pixels[index + 1];
          blue += pixels[index + 2];
          count += 1;
        }
        if (!count) throw new Error("empty");
        const color = `#${[mix(red / count), mix(green / count), mix(blue / count)]
          .map((channel) => channel.toString(16).padStart(2, "0"))
          .join("")}`;
        cache.set(url, color);
        resolve(color);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}
