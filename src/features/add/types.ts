/** One tile on the examples plate: an album, and the words under its sleeve. */
export interface ExampleRelease {
  /** MusicBrainz release-group id, which is what the covers endpoint answers about. */
  readonly albumId: string;
  readonly title: string;
  readonly artistName: string;
}
