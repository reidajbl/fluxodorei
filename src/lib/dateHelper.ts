export const dateHelper = {
  criarDataSegura(ano: number, mes: number, dia: number): string {
    const mesStr = String(mes).padStart(2, '0');
    const diaStr = String(dia).padStart(2, '0');
    return `${ano}-${mesStr}-${diaStr}`;
  },

  parseDataSegura(dataStr: string) {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    return { ano, mes, dia };
  },

  formatarParaExibicao(dataStr: string): string {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  },

  primeiroDiaMes(ano: number, mes: number): string {
    return this.criarDataSegura(ano, mes, 1);
  },

  ultimoDiaMes(ano: number, mes: number): string {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return this.criarDataSegura(ano, mes, ultimoDia);
  },

  hojeStr(): string {
    const now = new Date();
    return this.criarDataSegura(now.getFullYear(), now.getMonth() + 1, now.getDate());
  },

  mesAnoAtual(): { ano: number; mes: number } {
    const now = new Date();
    return { ano: now.getFullYear(), mes: now.getMonth() + 1 };
  },

  nomeMes(mes: number): string {
    const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return nomes[mes] || '';
  },

  formatarDataCompleta(dataStr: string): string {
    const { ano, mes, dia } = this.parseDataSegura(dataStr);
    const meses = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${dia} ${meses[mes]} ${ano}`;
  },
};
