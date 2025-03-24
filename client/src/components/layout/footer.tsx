import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
        <div>
          <p>© {new Date().getFullYear()} PainTrack. All rights reserved.</p>
        </div>
        <div className="flex space-x-4 mt-2 md:mt-0">
          <Link href="/privacy">
            <a className="hover:text-primary">Privacy Policy</a>
          </Link>
          <Link href="/terms">
            <a className="hover:text-primary">Terms of Service</a>
          </Link>
          <Link href="/contact">
            <a className="hover:text-primary">Contact Us</a>
          </Link>
        </div>
        <div className="flex items-center mt-2 md:mt-0">
          <span className="mr-2">Disclaimer:</span>
          <p className="text-xs">Not a substitute for professional medical advice.</p>
        </div>
      </div>
    </footer>
  );
}
