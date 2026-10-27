// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { tutorialStorage } from './tutorialStorage'

describe('tutorialStorage chapter progress', () => {
  beforeEach(() => localStorage.clear())

  it('marks chapters done and finds the first incomplete one', () => {
    const ids = ['a', 'b', 'c']
    expect(tutorialStorage.firstIncompleteChapter(ids)).toBe('a')
    tutorialStorage.markChapterDone('a')
    tutorialStorage.markChapterDone('a')
    expect(tutorialStorage.isChapterDone('a')).toBe(true)
    expect(tutorialStorage.isChapterDone('b')).toBe(false)
    expect(tutorialStorage.firstIncompleteChapter(ids)).toBe('b')
    tutorialStorage.markChapterDone('b')
    tutorialStorage.markChapterDone('c')
    expect(tutorialStorage.firstIncompleteChapter(ids)).toBe('a')
  })

  it('finishing recap marks the whole tutorial completed', () => {
    tutorialStorage.markChapterDone('orientation')
    expect(tutorialStorage.isCompleted()).toBe(false)
    tutorialStorage.markChapterDone('recap')
    expect(tutorialStorage.isCompleted()).toBe(true)
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('se.tutorial.chaptersDone', '{nope')
    expect(tutorialStorage.isChapterDone('a')).toBe(false)
    expect(tutorialStorage.firstIncompleteChapter(['a'])).toBe('a')
  })
})
