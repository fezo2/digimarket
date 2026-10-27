// A category's artwork, or its emoji on a tinted square when it has none.
export function CategoryThumb({
  category,
  className = "h-10 w-10 rounded-xl text-xl",
}: {
  category: { imageUrl?: string | null; icon?: string | null };
  className?: string;
}) {
  return category.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={category.imageUrl} alt="" loading="lazy" className={`shrink-0 object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center bg-brand-50 ${className}`}>{category.icon}</span>
  );
}
