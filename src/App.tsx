import { Routes, Route } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { NenecoinsInit } from "@/components/NenecoinsInit";

import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import LogoutPage from "@/pages/LogoutPage";
import PrimeiroAcessoPage from "@/pages/PrimeiroAcessoPage";
import RegrasPage from "@/pages/RegrasPage";
import ApostasPage from "@/pages/ApostasPage";
import ApostasNovaPage from "@/pages/ApostasNovaPage";
import ApostaDetailPage from "@/pages/ApostaDetailPage";
import PerguntasPage from "@/pages/PerguntasPage";
import PerguntasNovaPage from "@/pages/PerguntasNovaPage";
import PerguntaDetailPage from "@/pages/PerguntaDetailPage";
import FotosPage from "@/pages/FotosPage";
import FotosNovaPage from "@/pages/FotosNovaPage";
import FotoDetailPage from "@/pages/FotoDetailPage";
import DesafiosPage from "@/pages/DesafiosPage";
import DesafiosNovoPage from "@/pages/DesafiosNovoPage";
import DesafioDetailPage from "@/pages/DesafioDetailPage";
import CopaPage from "@/pages/CopaPage";
import CopaJogoPage from "@/pages/CopaJogoPage";
import CopaJogosPage from "@/pages/CopaJogosPage";
import CopaRankingPage from "@/pages/CopaRankingPage";
import CopaRegrasPage from "@/pages/CopaRegrasPage";
import PerfilPage from "@/pages/PerfilPage";
import NotFoundPage from "@/pages/NotFoundPage";

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route path="/primeiro-acesso" element={<PrimeiroAcessoPage />} />
        <Route path="/regras" element={<RegrasPage />} />
        <Route path="/apostas" element={<ApostasPage />} />
        <Route path="/apostas/nova" element={<ApostasNovaPage />} />
        <Route path="/apostas/:id" element={<ApostaDetailPage />} />
        <Route path="/perguntas" element={<PerguntasPage />} />
        <Route path="/perguntas/nova" element={<PerguntasNovaPage />} />
        <Route path="/perguntas/:id" element={<PerguntaDetailPage />} />
        <Route path="/fotos" element={<FotosPage />} />
        <Route path="/fotos/nova" element={<FotosNovaPage />} />
        <Route path="/fotos/desafios" element={<DesafiosPage />} />
        <Route path="/fotos/desafios/novo" element={<DesafiosNovoPage />} />
        <Route path="/fotos/desafios/:id" element={<DesafioDetailPage />} />
        <Route path="/fotos/:id" element={<FotoDetailPage />} />
        <Route path="/copa" element={<CopaPage />} />
        <Route path="/copa/jogo/:id" element={<CopaJogoPage />} />
        <Route path="/copa/jogos" element={<CopaJogosPage />} />
        <Route path="/copa/ranking" element={<CopaRankingPage />} />
        <Route path="/copa/regras" element={<CopaRegrasPage />} />
        <Route path="/perfil/:nickname" element={<PerfilPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <BottomNav />
      <NenecoinsInit />
    </>
  );
}
