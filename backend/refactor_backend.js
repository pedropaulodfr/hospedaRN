const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

const replacements = [
  // 1. Enums Specific (must come first)
  [/\bUserRole\.GUEST\b/g, 'PerfilUsuario.HOSPEDE'],
  [/\bUserRole\.ESTABLISHMENT\b/g, 'PerfilUsuario.ESTABELECIMENTO'],
  [/\bUserRole\.ADMIN\b/g, 'PerfilUsuario.ADMIN'],
  [/\bUserRole\b/g, 'PerfilUsuario'],
  [/\b'GUEST'\b/g, "'HOSPEDE'"],
  [/\b'ESTABLISHMENT'\b/g, "'ESTABELECIMENTO'"],
  [/\b'ADMIN'\b/g, "'ADMIN'"],
  [/\b"GUEST"\b/g, '"HOSPEDE"'],
  [/\b"ESTABLISHMENT"\b/g, '"ESTABELECIMENTO"'],
  [/\b"ADMIN"\b/g, '"ADMIN"'],
  
  [/\bReservationStatus\b/g, 'StatusReserva'],
  [/\bPaymentMethod\b/g, 'MetodoPagamento'],
  [/\bPaymentStatus\b/g, 'StatusPagamento'],

  // 2. Specific Columns & Fields
  [/\bestablishmentId\b/g, 'estabelecimentoId'],
  [/\baccommodationTypeId\b/g, 'tipoAcomodacaoId'],
  [/\bcityId\b/g, 'cidadeId'],
  [/\bownerId\b/g, 'proprietarioId'],
  [/\brole\b/g, 'perfil'],
  [/\brefreshTokenHash\b/g, 'tokenAtualizacaoHash'],
  [/\bresetPasswordToken\b/g, 'tokenRecuperacaoSenha'],
  [/\bresetPasswordExpires\b/g, 'expiracaoRecuperacaoSenha'],
  [/\bcreatedAt\b/g, 'criadoEm'],
  [/\bupdatedAt\b/g, 'atualizadoEm'],
  [/\blocation\b/g, 'localizacao'],
  [/\broomId\b/g, 'quartoId'],
  [/\bseasonId\b/g, 'temporadaId'],
  [/\breservationId\b/g, 'reservaId'],
  [/\btransactionCode\b/g, 'codigoTransacao'],
  [/\bcomprovanteUrl\b/g, 'comprovanteUrl'],
  [/\bcomprovanteS3Key\b/g, 'comprovanteS3Key'],
  [/\bdadosPagamento\b/g, 'dadosPagamento'],
  [/\blinkOficial\b/g, 'linkOficial'],
  [/\bdataInicio\b/g, 'dataInicio'],
  [/\bdataFim\b/g, 'dataFim'],
  [/\bimagemUrl\b/g, 'imagemUrl'],
  [/\bimagemS3Key\b/g, 'imagemS3Key'],
  [/\bemailContato\b/g, 'emailContato'],
  [/\bipAddress\b/g, 'enderecoIp'],
  [/\buserAgent\b/g, 'agenteUsuario'],
  [/\bmotivo\b/g, 'motivo'],
  [/\bhospedeId\b/g, 'hospedeId'],
  [/\bcodigoReserva\b/g, 'codigoReserva'],
  [/\bvalorTotal\b/g, 'valorTotal'],

  // 3. Base Model Names (Case Sensitive Plurals first, then Singulars)
  [/\bestablishments\b/g, 'estabelecimentos'],
  [/\bEstablishments\b/g, 'Estabelecimentos'],
  [/\bestablishment\b/g, 'estabelecimento'],
  [/\bEstablishment\b/g, 'Estabelecimento'],
  
  [/\brooms\b/g, 'quartos'],
  [/\bRooms\b/g, 'Quartos'],
  [/\broom\b/g, 'quarto'],
  [/\bRoom\b/g, 'Quarto'],
  
  [/\breservations\b/g, 'reservas'],
  [/\bReservations\b/g, 'Reservas'],
  [/\breservation\b/g, 'reserva'],
  [/\bReservation\b/g, 'Reserva'],
  
  [/\bphotos\b/g, 'fotos'],
  [/\bPhotos\b/g, 'Fotos'],
  [/\bphoto\b/g, 'foto'],
  [/\bPhoto\b/g, 'Foto'],

  [/\bprices\b/g, 'precos'],
  [/\bPrices\b/g, 'Precos'],
  [/\bprice\b/g, 'preco'],
  [/\bPrice\b/g, 'Preco'],

  [/\bpayments\b/g, 'pagamentos'],
  [/\bPayments\b/g, 'Pagamentos'],
  [/\bpayment\b/g, 'pagamento'],
  [/\bPayment\b/g, 'Pagamento'],

  [/\bevents\b/g, 'eventos'],
  [/\bEvents\b/g, 'Eventos'],
  [/\bevent\b/g, 'evento'],
  [/\bEvent\b/g, 'Evento'],

  [/\beventCities\b/g, 'eventosCidades'],
  [/\bEventCities\b/g, 'EventosCidades'],
  [/\beventCity\b/g, 'eventoCidade'],
  [/\bEventCity\b/g, 'EventoCidade'],

  [/\breviews\b/g, 'avaliacoes'],
  [/\bReviews\b/g, 'Avaliacoes'],
  [/\breview\b/g, 'avaliacao'],
  [/\bReview\b/g, 'Avaliacao'],

  [/\bfavorites\b/g, 'favoritos'],
  [/\bFavorites\b/g, 'Favoritos'],
  [/\bfavorite\b/g, 'favorito'],
  [/\bFavorite\b/g, 'Favorito'],

  [/\bauditLogs\b/g, 'logsAuditoria'],
  [/\bAuditLogs\b/g, 'LogsAuditoria'],
  [/\bauditLog\b/g, 'logAuditoria'],
  [/\bAuditLog\b/g, 'LogAuditoria'],

  [/\bdateBlocks\b/g, 'bloqueiosData'],
  [/\bDateBlocks\b/g, 'BloqueiosData'],
  [/\bdateBlock\b/g, 'bloqueioData'],
  [/\bDateBlock\b/g, 'BloqueioData'],

  [/\bamenities\b/g, 'comodidades'],
  [/\bAmenities\b/g, 'Comodidades'],
  [/\bamenity\b/g, 'comodidade'],
  [/\bAmenity\b/g, 'Comodidade'],

  [/\baccommodationTypes\b/g, 'tiposAcomodacao'],
  [/\bAccommodationTypes\b/g, 'TiposAcomodacao'],
  [/\baccommodationType\b/g, 'tipoAcomodacao'],
  [/\bAccommodationType\b/g, 'TipoAcomodacao'],

  [/\bseasons\b/g, 'temporadas'],
  [/\bSeasons\b/g, 'Temporadas'],
  [/\bseason\b/g, 'temporada'],
  [/\bSeason\b/g, 'Temporada'],

  [/\broomPrices\b/g, 'precosQuarto'],
  [/\bRoomPrices\b/g, 'PrecosQuarto'],
  [/\broomPrice\b/g, 'precoQuarto'],
  [/\bRoomPrice\b/g, 'PrecoQuarto'],

  [/\bcities\b/g, 'cidades'],
  [/\bCities\b/g, 'Cidades'],
  [/\bcity\b/g, 'cidade'],
  [/\bCity\b/g, 'Cidade'],

  [/\busers\b/g, 'usuarios'],
  [/\bUsers\b/g, 'Usuarios'],
  [/\buser\b/g, 'usuario'],
  [/\bUser\b/g, 'Usuario'],

  [/\bowner\b/g, 'proprietario'],
  [/\bOwner\b/g, 'Proprietario'],

  // Specific DTO mappings
  [/\bSearchEstablishmentsDto\b/g, 'BuscaEstabelecimentosDto'],
];

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (stat.isFile() && filePath.endsWith('.ts')) {
      refactorFile(filePath);
    }
  }
}

walkDir(directory);
console.log('Backend refactoring V2 completed!');
