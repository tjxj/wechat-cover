'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import html2canvas from 'html2canvas'

export function FixedBackgroundWeChatCoverCard() {
  const [text, setText] = useState("Talk is cheap, show me your code.")
  const [isEditing, setIsEditing] = useState(false)
  const cardRef = useRef(null)
  const inputRef = useRef(null)
  const [colorScheme, setColorScheme] = useState(0)

  const colorSchemes = [
    'linear-gradient(45deg, #ff9a9e, #fad0c4, #a1c4fd, #c2e9fb)',
    'linear-gradient(45deg, #f6d365, #fda085, #f093fb, #f5576c)',
    'linear-gradient(45deg, #84fab0, #8fd3f4, #a1c4fd, #c2e9fb)',
    'linear-gradient(45deg, #667eea, #764ba2, #6B8DD6, #8E37D7)',
    'linear-gradient(45deg, #ff758c, #ff7eb3, #ff83a6, #ff8a97)',
    'linear-gradient(45deg, #43e97b, #38f9d7, #4facfe, #00f2fe)',
    'linear-gradient(45deg, #fa709a, #fee140, #ffcda5, #ffa8a8)',
    'linear-gradient(45deg, #30cfd0, #330867, #5b3cc4, #3b2667)',
    'linear-gradient(45deg, #7f7fd5, #86a8e7, #91eae4, #86a8e7)',
    'linear-gradient(45deg, #f83600, #f9d423, #f83600, #f9d423)',
    // ... 继续添加更多配色方案，直到达到 100 个
  ]

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const downloadAsPng = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      })
      const image = canvas.toDataURL("image/png")
      const link = document.createElement('a')
      link.href = image
      link.download = 'wechat-cover.png'
      link.click()
    }
  }

  const handleTextClick = () => {
    setIsEditing(true)
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
  }

  const handleTextBlur = () => {
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400">
      <div className="absolute inset-0 bg-gradient-animation"></div>
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
        <motion.div 
          ref={cardRef}
          className="relative w-[1128px] h-[480px] rounded-lg overflow-hidden shadow-lg bg-gradient-animation"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-8 bg-gradient-animation">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleTextChange}
                onBlur={handleTextBlur}
                onKeyDown={handleKeyDown}
                className="w-full text-5xl font-bold text-center bg-transparent text-white border-none outline-none"
              />
            ) : (
              <motion.div 
                className="text-center cursor-pointer"
                onClick={handleTextClick}
                initial={{ opacity: 0, filter: "blur(10px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 1, ease: "easeInOut" }}
              >
                {text.split('').map((char, index) => (
                  <motion.span
                    key={index}
                    className="text-5xl font-bold text-white"
                    initial={{ opacity: 0, filter: "blur(5px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    {char}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
        <motion.button 
          onClick={downloadAsPng}
          className="flex items-center gap-2 px-6 py-3 mt-8 bg-white text-black rounded-md hover:bg-opacity-90 transition-colors"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Download size={20} />
          Download as PNG
        </motion.button>
        <motion.button 
          onClick={() => setColorScheme((prev) => (prev + 1) % colorSchemes.length)}
          className="flex items-center gap-2 px-6 py-3 mt-4 bg-white text-black rounded-md hover:bg-opacity-90 transition-colors"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          Change Color Scheme
        </motion.button>
      </div>
      <style jsx>{`
        .bg-gradient-animation {
          background: ${colorSchemes[colorScheme]};
          background-size: 400% 400%;
          animation: gradientAnimation 10s ease infinite;
        }
        @keyframes gradientAnimation {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
      `}</style>
    </div>
  )
}