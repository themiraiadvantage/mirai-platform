export const LAND_PHOTOS = ["/images/land-1.jpg", "/images/land-2.jpg", "/images/land-3.jpg"];
export const plotPhoto = (i:number) => LAND_PHOTOS[i % LAND_PHOTOS.length]!;
