import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="w-full border-t border-border/30 bg-card/50 backdrop-blur-sm py-6 mt-auto">
      <div className="mx-auto max-w-6xl px-4 flex flex-col items-center gap-4">
        <Link to="/dashboard">
          <img 
            src={logo} 
            alt="Logo" 
            className="h-20 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
            loading="lazy"
            decoding="async"
          />
        </Link>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} DNOTAS TREINAMENTOS. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
