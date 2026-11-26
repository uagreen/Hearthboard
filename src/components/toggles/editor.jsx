import { MdEdit } from "react-icons/md";

// Hearthboard: link to the built-in configuration editor (only rendered when it is enabled).
export default function EditorLink() {
  return (
    <a
      id="editor-link"
      href="/editor"
      title="Editor"
      aria-label="Editor"
      className="rounded-full flex align-middle self-center mr-3"
    >
      <MdEdit className="text-theme-800 dark:text-theme-200 w-6 h-6 cursor-pointer" />
    </a>
  );
}
