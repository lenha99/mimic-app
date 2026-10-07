import styles from "./youtube-clip.module.css";

/**
 * 유튜브 구간을 카드뉴스처럼 넘겨 보는 카드. 1장은 영상, 2장은 안내.
 * 공식 임베드라 소리는 우리가 가져오지 않는다. 자동재생은 없다 — 재생은 사용자가 누른다.
 * 이 영상의 소리는 채점에 쓰지 않는다.
 */
export function YoutubeClip({
  id,
  start,
  end,
  title,
}: {
  id: string;
  start: number;
  end: number;
  title: string;
}) {
  const src =
    `https://www.youtube-nocookie.com/embed/${id}` +
    `?start=${start}&end=${end}&rel=0&playsinline=1&modestbranding=1`;

  return (
    <figure className={styles.wrap}>
      <div className={styles.track} tabIndex={0} aria-label={`${title} 원본 카드`}>
        <section className={styles.slide}>
          <div className={styles.frame}>
            <iframe
              src={src}
              title={`${title} 원본 영상`}
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </section>
        <section className={styles.slide}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>들을 때 알아둘 것</p>
            <p className={styles.cardText}>
              재생하면 원본 소리가 마이크에 섞일 수 있어요. 이어폰을 끼면 더 정확해요.
            </p>
          </div>
        </section>
      </div>
      <p className={styles.hint}>옆으로 넘기면 안내가 나와요</p>
    </figure>
  );
}
