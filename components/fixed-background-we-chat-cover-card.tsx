'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import html2canvas from 'html2canvas'

export function FixedBackgroundWeChatCoverCard() {
  const [text, setText] = useState("Talk is cheap, show me your code.")
  const [isEditing, setIsEditing] = useState(false)
  const cardRef = useRef(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
    'linear-gradient(45deg, #a8edea, #fed6e3, #a8edea, #fed6e3)',
    'linear-gradient(45deg, #5ee7df, #b490ca, #5ee7df, #b490ca)',
    'linear-gradient(45deg, #d299c2, #fef9d7, #d299c2, #fef9d7)',
    'linear-gradient(45deg, #f5f7fa, #c3cfe2, #f5f7fa, #c3cfe2)',
    'linear-gradient(45deg, #fdcbf1, #e6dee9, #fdcbf1, #e6dee9)',
    'linear-gradient(45deg, #a1c4fd, #c2e9fb, #a1c4fd, #c2e9fb)',
    'linear-gradient(45deg, #cfd9df, #e2ebf0, #cfd9df, #e2ebf0)',
    'linear-gradient(45deg, #a6c0fe, #f68084, #a6c0fe, #f68084)',
    'linear-gradient(45deg, #fccb90, #d57eeb, #fccb90, #d57eeb)',
    'linear-gradient(45deg, #e0c3fc, #8ec5fc, #e0c3fc, #8ec5fc)',
    'linear-gradient(45deg, #f093fb, #f5576c, #f093fb, #f5576c)',
    'linear-gradient(45deg, #fdfbfb, #ebedee, #fdfbfb, #ebedee)',
    'linear-gradient(45deg, #4facfe, #00f2fe, #4facfe, #00f2fe)',
    'linear-gradient(45deg, #43e97b, #38f9d7, #43e97b, #38f9d7)',
    'linear-gradient(45deg, #fa709a, #fee140, #fa709a, #fee140)',
    'linear-gradient(45deg, #30cfd0, #330867, #30cfd0, #330867)',
    'linear-gradient(45deg, #a8caba, #5d4157, #a8caba, #5d4157)',
    'linear-gradient(45deg, #29323c, #485563, #29323c, #485563)',
    'linear-gradient(45deg, #ff6e7f, #bfe9ff, #ff6e7f, #bfe9ff)',
    'linear-gradient(45deg, #2af598, #009efd, #2af598, #009efd)',
    'linear-gradient(45deg, #b721ff, #21d4fd, #b721ff, #21d4fd)',
    'linear-gradient(45deg, #8e2de2, #4a00e0, #8e2de2, #4a00e0)',
    'linear-gradient(45deg, #f77062, #fe5196, #f77062, #fe5196)',
    'linear-gradient(45deg, #c471f5, #fa71cd, #c471f5, #fa71cd)',
    'linear-gradient(45deg, #48c6ef, #6f86d6, #48c6ef, #6f86d6)',
    'linear-gradient(45deg, #feada6, #f5efef, #feada6, #f5efef)',
    'linear-gradient(45deg, #65bd60, #5ac1a8, #65bd60, #5ac1a8)',
    'linear-gradient(45deg, #0ba360, #3cba92, #0ba360, #3cba92)',
    'linear-gradient(45deg, #fbc2eb, #a6c1ee, #fbc2eb, #a6c1ee)',
    'linear-gradient(45deg, #ff0844, #ffb199, #ff0844, #ffb199)',
    'linear-gradient(45deg, #d4fc79, #96e6a1, #d4fc79, #96e6a1)',
    'linear-gradient(45deg, #00dbde, #fc00ff, #00dbde, #fc00ff)',
    'linear-gradient(45deg, #f9d423, #ff4e50, #f9d423, #ff4e50)',
    'linear-gradient(45deg, #50cc7f, #f5d100, #50cc7f, #f5d100)',
    'linear-gradient(45deg, #88d3ce, #6e45e2, #88d3ce, #6e45e2)',
    'linear-gradient(45deg, #d9afd9, #97d9e1, #d9afd9, #97d9e1)',
    'linear-gradient(45deg, #7028e4, #e5b2ca, #7028e4, #e5b2ca)',
    'linear-gradient(45deg, #13547a, #80d0c7, #13547a, #80d0c7)',
    'linear-gradient(45deg, #ff3cac, #562b7c, #ff3cac, #562b7c)',
    'linear-gradient(45deg, #f83600, #f9d423, #f83600, #f9d423)',
    'linear-gradient(45deg, #b721ff, #21d4fd, #b721ff, #21d4fd)',
    'linear-gradient(45deg, #6a11cb, #2575fc, #6a11cb, #2575fc)',
    'linear-gradient(45deg, #37ecba, #72afd3, #37ecba, #72afd3)',
    'linear-gradient(45deg, #ebbba7, #cfc7f8, #ebbba7, #cfc7f8)',
    'linear-gradient(45deg, #ff9a9e, #fecfef, #ff9a9e, #fecfef)',
    'linear-gradient(45deg, #f6d365, #fda085, #f6d365, #fda085)',
    'linear-gradient(45deg, #fbc2eb, #a6c1ee, #fbc2eb, #a6c1ee)',
    'linear-gradient(45deg, #fdcbf1, #e6dee9, #fdcbf1, #e6dee9)',
    'linear-gradient(45deg, #a1c4fd, #c2e9fb, #a1c4fd, #c2e9fb)',
    'linear-gradient(45deg, #d4fc79, #96e6a1, #d4fc79, #96e6a1)',
    'linear-gradient(45deg, #84fab0, #8fd3f4, #84fab0, #8fd3f4)',
    'linear-gradient(45deg, #cfd9df, #e2ebf0, #cfd9df, #e2ebf0)',
    'linear-gradient(45deg, #a6c0fe, #f68084, #a6c0fe, #f68084)',
    'linear-gradient(45deg, #fccb90, #d57eeb, #fccb90, #d57eeb)',
    'linear-gradient(45deg, #e0c3fc, #8ec5fc, #e0c3fc, #8ec5fc)',
    'linear-gradient(45deg, #f093fb, #f5576c, #f093fb, #f5576c)',
    'linear-gradient(45deg, #4facfe, #00f2fe, #4facfe, #00f2fe)',
    'linear-gradient(45deg, #43e97b, #38f9d7, #43e97b, #38f9d7)',
    'linear-gradient(45deg, #fa709a, #fee140, #fa709a, #fee140)',
    'linear-gradient(45deg, #30cfd0, #330867, #30cfd0, #330867)',
    'linear-gradient(45deg, #a8caba, #5d4157, #a8caba, #5d4157)',
    'linear-gradient(45deg, #29323c, #485563, #29323c, #485563)',
    'linear-gradient(45deg, #ff6e7f, #bfe9ff, #ff6e7f, #bfe9ff)',
    'linear-gradient(45deg, #2af598, #009efd, #2af598, #009efd)',
    'linear-gradient(45deg, #b721ff, #21d4fd, #b721ff, #21d4fd)',
    'linear-gradient(45deg, #8e2de2, #4a00e0, #8e2de2, #4a00e0)',
    'linear-gradient(45deg, #f77062, #fe5196, #f77062, #fe5196)',
    'linear-gradient(45deg, #c471f5, #fa71cd, #c471f5, #fa71cd)',
    'linear-gradient(45deg, #48c6ef, #6f86d6, #48c6ef, #6f86d6)',
    'linear-gradient(45deg, #feada6, #f5efef, #feada6, #f5efef)',
    'linear-gradient(45deg, #65bd60, #5ac1a8, #65bd60, #5ac1a8)',
    'linear-gradient(45deg, #0ba360, #3cba92, #0ba360, #3cba92)',
    'linear-gradient(45deg, #fbc2eb, #a6c1ee, #fbc2eb, #a6c1ee)',
    'linear-gradient(45deg, #ff0844, #ffb199, #ff0844, #ffb199)',
    'linear-gradient(45deg, #d4fc79, #96e6a1, #d4fc79, #96e6a1)',
    'linear-gradient(45deg, #00dbde, #fc00ff, #00dbde, #fc00ff)',
    'linear-gradient(45deg, #f9d423, #ff4e50, #f9d423, #ff4e50)',
    'linear-gradient(45deg, #50cc7f, #f5d100, #50cc7f, #f5d100)',
    'linear-gradient(45deg, #88d3ce, #6e45e2, #88d3ce, #6e45e2)',
    'linear-gradient(45deg, #d9afd9, #97d9e1, #d9afd9, #97d9e1)',
    'linear-gradient(45deg, #7028e4, #e5b2ca, #7028e4, #e5b2ca)',
    'linear-gradient(45deg, #13547a, #80d0c7, #13547a, #80d0c7)',
    'linear-gradient(45deg, #ff3cac, #562b7c, #ff3cac, #562b7c)',
    'linear-gradient(45deg, #f83600, #f9d423, #f83600, #f9d423)',
    'linear-gradient(45deg, #b721ff, #21d4fd, #b721ff, #21d4fd)',
    'linear-gradient(45deg, #6a11cb, #2575fc, #6a11cb, #2575fc)',
    'linear-gradient(45deg, #37ecba, #72afd3, #37ecba, #72afd3)',
    'linear-gradient(45deg, #ebbba7, #cfc7f8, #ebbba7, #cfc7f8)',
    'linear-gradient(45deg, #ff9a9e, #fecfef, #ff9a9e, #fecfef)',
    'linear-gradient(45deg, #f6d365, #fda085, #f6d365, #fda085)',
    'linear-gradient(45deg, #fbc2eb, #a6c1ee, #fbc2eb, #a6c1ee)',
    'linear-gradient(45deg, #fdcbf1, #e6dee9, #fdcbf1, #e6dee9)',
    'linear-gradient(45deg, #a1c4fd, #c2e9fb, #a1c4fd, #c2e9fb)',
    'linear-gradient(45deg, #d4fc79, #96e6a1, #d4fc79, #96e6a1)',
    'linear-gradient(45deg, #84fab0, #8fd3f4, #84fab0, #8fd3f4)',
    'linear-gradient(45deg, #cfd9df, #e2ebf0, #cfd9df, #e2ebf0)',
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