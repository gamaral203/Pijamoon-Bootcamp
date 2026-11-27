// CloudFront Function (viewer request): completa endereços de pasta.
//
// O S3 privado (acessado pelo CloudFront via OAC) não sabe que "/pedidos/"
// quer dizer "/pedidos/index.html": ele responderia 403. Esta função roda na
// borda, antes do cache, e completa o caminho:
//   /pedidos/  → /pedidos/index.html
//   /pedidos   → /pedidos/index.html
//   /css/style.css → não muda (tem extensão)
// As rotas /api/* não passam por aqui (outro comportamento da distribuição).
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (uri.split('/').pop().indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }
  return request;
}
