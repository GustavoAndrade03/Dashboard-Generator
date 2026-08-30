import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

/**
 * Duas famílias, três papéis.
 *
 * O Archivo é variável no eixo de largura, e é daí que vem o contraste
 * tipográfico do produto: o mesmo desenho em 118% de largura para a voz da
 * interface, em largura normal para o texto corrido. Foi desenhado para
 * documento e formulário impressos, que é exatamente o que sai daqui.
 *
 * O mono não é enfeite: carrega o registro utilitário — número de página,
 * contagem de linhas, tipo de coluna. O que a máquina leu se distingue à
 * primeira vista do que a interface diz.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Planilha em Dashboard",
  description:
    "Transforme planilhas .xlsx desestruturadas em dashboards visuais exportáveis em PDF.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
