import React, { useState } from "react";

export default function FadeInImage({ src, alt, className, style, ...props }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      className={`${className || ""} ${isLoaded ? "loaded" : ""}`}
      style={{
        opacity: isLoaded ? 1 : 0,
        transition: "opacity 0.4s ease-in-out",
        ...style,
      }}
      loading="lazy"
      onLoad={() => setIsLoaded(true)}
      {...props}
    />
  );
}
