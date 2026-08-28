/**
 * Gera uma planilha propositalmente bagunçada para testar a Camada 1 na mão:
 * título solto antes do cabeçalho, cabeçalho em dois níveis com células
 * mescladas, números em formato brasileiro e uma aba sem coluna numérica.
 *
 *   node tests/fixtures/make-sample-xlsx.mjs caminho/de/saida.xlsx
 */

// exceljs é CommonJS: em ESM puro só o export default funciona.
import exceljs from "exceljs";

const { Workbook } = exceljs;

const wb = new Workbook();

// Aba 1: título solto, linha vazia, cabeçalho na linha 4, números pt-BR.
const s1 = wb.addWorksheet("Vendas 2024");
s1.addRow(["Relatório de vendas — confidencial"]);
s1.addRow([]);
s1.addRow([]);
s1.addRow(["Data", "Região", "Vendedor", "Faturamento", "Qtd"]);
const regioes = ["Sul", "Norte", "Leste", "Oeste"];
const nomes = ["Ana", "Bruno", "Carla", "Diego", "Elisa"];
for (let i = 0; i < 120; i++) {
  const dia = String((i % 28) + 1).padStart(2, "0");
  const mes = String((i % 6) + 1).padStart(2, "0");
  s1.addRow([
    `${dia}/${mes}/2024`,
    regioes[i % regioes.length],
    nomes[i % nomes.length],
    `R$ ${(1000 + i * 37).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    (i % 9) + 1,
  ]);
}

// Aba 2: cabeçalho de dois níveis com células mescladas.
const s2 = wb.addWorksheet("Metas");
s2.addRow(["1o Semestre", null, "2o Semestre", null]);
s2.mergeCells("A1:B1");
s2.mergeCells("C1:D1");
s2.addRow(["Meta", "Real", "Meta", "Real"]);
for (let i = 0; i < 20; i++) {
  s2.addRow([100 + i, 90 + i * 2, 200 + i, 180 + i * 3]);
}

// Aba 3: só categorias, sem coluna numérica.
const s3 = wb.addWorksheet("Chamados");
s3.addRow(["Categoria", "Status", "Urgente"]);
const cats = ["Rede", "Sistema", "Acesso"];
for (let i = 0; i < 40; i++) {
  s3.addRow([cats[i % 3], i % 2 === 0 ? "Aberto" : "Fechado", i % 3 === 0 ? "Sim" : "Não"]);
}

await wb.xlsx.writeFile(process.argv[2]);
console.log("fixture criada:", process.argv[2]);
