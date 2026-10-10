/** Downloads a file (the route answers with Content-Disposition: attachment) without leaving the page. */
export function downloadFile(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.click();
}
