import styles from "./youtube-clip.module.css";

/**
 * 유튜브 구간 임베드. 공식 임베드 방식이라 영상 소리는 우리가 가져오지 않는다.
 * 재생은 사용자가 직접 누른다(자동재생 없음). 이 영상의 소리는 채점에 쓰지 않는다.
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
      <figcaption className={styles.notice}>
        재생하면 원본 소리가 마이크에 섞일 수 있어요. 이어폰을 끼면 더 정확해요.
      </figcaption>
    </figure>
  );
}
