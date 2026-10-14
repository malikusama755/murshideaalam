import Link from "next/link";

export default function NotFound() {
  return (
    <article className="legacy">
      <h2>This page is not on the site</h2>
      <p>
        The page you asked for is not on this site. Go back to the <Link href="/">home page</Link>.
      </p>
    </article>
  );
}
